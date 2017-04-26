import cheerio from 'cheerio';
import request from 'request';
var Horseman = require('node-horseman');
var MongoClient = require('mongodb').MongoClient;

import events from 'events';
const eventEmitter = new events.EventEmitter();

// Internal dependencies
import { Author, Comment } from './models';


const DB_URL = 'mongodb://172.17.0.2:27017/opiniorizer';

const TRIP_ADVISOR_URL = "https://www.tripadvisor.com";
const TRIP_ADVISOR_SEARCH_URL = ( criteria ) => ( `${TRIP_ADVISOR_URL}/Search?q=${criteria}` );
const TRIP_ADVISOR_REVIEW_URL = ( review ) => ( `${TRIP_ADVISOR_URL}${review}` );
const MAX_N_WORKERS = 5;

let BASE_REVIEW_URL = "";

export default class PoiCollector {

	collect( poi ) {
		
		this.discoverUrl( poi ).then( ( url ) => {
		
			this.discoverHowManyPages( TRIP_ADVISOR_REVIEW_URL( url ) ).then( ( number ) => {

				// let workers = this.startWorkers( number );
				
				// Promise.all(workers).then( ( result ) => {

				// 	console.log("Finish workers");
				// 	
				
				this.createWorker();
				eventEmitter.emit( 'nextCollect', 1, number );

				// }, this.dispatchError );

			}, this.dispatchError);
			
		}, this.dispatchError );
	}

	// Discover which url must be appended to base url to fetch reviews
	discoverUrl( poi ) {
		
		return this.executeAsync( (resolve, reject) => {

			const searchUrl = TRIP_ADVISOR_SEARCH_URL( poi );
			
			request.get( searchUrl, (error, response, body) => {
				
				if(error)
					reject(error);

				const $ = cheerio.load(body);

				const results = $('#search_result');

				const poi_result =  results.children().get(1).children[0].children[0]; //results.children[1].children[0].children[0];
				const poi_reviews = poi_result.children[1].children[1];
				
				const reviews_url = poi_reviews.children[1].attribs.href;
				
				BASE_REVIEW_URL = reviews_url

				resolve(reviews_url);
			} );

		} );

		

	}

	// Discover how many pages a review owns
	discoverHowManyPages( review ) {
		
		return this.executeAsync( ( resolve, reject ) => {
			
			request.get( review, ( error, response, body ) => {

				if(error)
					reject(error);

				const $ = cheerio.load(body);
				const pageBar = $('.pageNumbers');
				
				const lastPageElement = pageBar.children().get(pageBar.children().length - 1);	
				
				resolve(lastPageElement.children[0].data);
			} );		

		} );


	}

	// Start works defining which pages every worker will collect
	startWorkers( numberPages ) {
		
		console.log("Starting workers");	
		console.log("Pages: " + numberPages);

		let workers = [];
		const nPagesPerWorker = parseInt(( numberPages /  MAX_N_WORKERS ));
		
		for(let p = 1; p <= numberPages; p += nPagesPerWorker){
			
			if(p + nPagesPerWorker > numberPages)
				workers.push( this.createWorker( p,  numberPages - p) );
			else
				workers.push( this.createWorker( p, nPagesPerWorker ) );
			
		}

		return workers;
	}

	// Create a worker responsible for collecting reviews in such pages
	createWorker( maxPages ) {
			
		
		eventEmitter.on('nextCollect', ( page ) => {
		
			console.log("Collecting page " + page + "...");

			if( page > maxPages ){
				eventEmitter.removeListener('nextCollect');
				return;
			}

			const action = function(err, db) {
			 	
				if(err){
					console.log("MongoDB connection error");
					return;
				}

				const collection = db.collection('opinions');

				let partsUrl = BASE_REVIEW_URL.split('-');
				
				let task;

				if(page == 1)
					task = this.collectReviews( collection, TRIP_ADVISOR_REVIEW_URL( BASE_REVIEW_URL ) );
					// this.collectReviews( TRIP_ADVISOR_REVIEW_URL( BASE_REVIEW_URL ) );
				else {

					const offset = (page-1) * 10;
					let urlTemp = partsUrl.slice(0, partsUrl.length);

					urlTemp.splice(4, 0, `or${offset}`);

					const baseUrl = urlTemp.join('-');

					console.log(TRIP_ADVISOR_REVIEW_URL( baseUrl ));

					task = this.collectReviews( collection, TRIP_ADVISOR_REVIEW_URL( baseUrl ) );

				}


				task.then( () => {

					db.close();
					eventEmitter.emit('nextCollect', page + 1);

				} );
							

			}.bind(this);

			MongoClient.connect(DB_URL, action);
			

		});

		

	}

	// Collect reviews according to full url ( tripAdvisor_url + review_url_base )
	collectReviews( collection, url ) {
		
		console.log("Collecting reviews");
		
		return new Promise( (resolve, reject) => {

			const horseman = new Horseman();	

			horseman
				.open( url )
				.waitForSelector( '.review.basic_review.inlineReviewUpdate.provider0', { timeout: 10000 } )
				.waitForSelector( '.review.basic_review.inlineReviewUpdate.provider0 .partnerRvw .taLnk', { timeout: 10000 } )
				.click( '.review.basic_review.inlineReviewUpdate.provider0 .partnerRvw .taLnk' )
				.waitForSelector( '.review.dyn_full_review.inlineReviewUpdate.provider0', { timeout: 10000 } )
				.evaluate( () => {
					
					return $( 'body' ).html();

				} )
				.then( ( body ) => {
					
						const $ = cheerio.load( body );
						const reviews = $('.review.dyn_full_review.inlineReviewUpdate.provider0');
						
						// console.log(reviews);

						Object.keys( reviews ).forEach( ( pos ) => {

								if( !isNaN(pos) ) {

									const reviewsInfosComp = reviews[pos].children[3];
									// console.log(reviewsInfosComp);
									const authorInfos = this.collectAuthorInfos( reviewsInfosComp.children[1] );
									const comment = this.collectCommentInfos( reviewsInfosComp.children[3] );

									comment.author = authorInfos
									
									// Save comment into database
									collection.insert(comment);
								}	

						} )
						

					return;

				} ).finally( () => {
					console.log("Finished collecting");
					horseman.close();
					resolve();
				} );
			
		} );



		// let phInstance = null;
		
		// phantom.create().then( instance => {
		// 	phInstance = instance;
		// 	return instance.createPage();
		// } )
		// .then( page => {
		// 	page.open(url);
		// 	return page;

		// } )
		// .then( page => {
		// 	page.includeJs("http://ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.min.js");
		// 	return page;
		// } )
		// .then( page => {
		// 	return page.evaluate( () => {
		// 		return $('.review.basic_review.inlineReviewUpdate.provider0.newFlag').html();
		// 	} )
		// 	.then ( html => {
		// 		console.log(html);
		// 		phInstance.exit();
		// 	} );
		// } )
		
		// .catch( error => {
		// 	console.log(error);
		// 	if(phInstance)
		// 		phInstance.exit();
		// });




		// jsdom.env(url, [ 'http://code.jquery.com/jquery-1.7.min.js' ], done);

		// function done (errors, window) {
		//   const $ = window.$;
		  
		//   let content = $('.review.basic_review.inlineReviewUpdate.provider0.newFlag').find('.partnerRvw');
		//   if(content.length > 0){
		  	
		//   	let moreButton = $(content[0]).first();
		//   	moreButton.click();

		// 	let extendedContents = $('.review.dyn_full_review.inlineReviewUpdate.provider0.newFlag');
		// 	console.log(extendedContents);

		//   }
		  



		// }

		// request.get( url, ( error, response, body ) => {

		// 	if(error)
		// 		return error;

		// 	const $ = cheerio.load(body);
		// 	const reviews = $('.review.basic_review.inlineReviewUpdate.provider0.newFlag');
			
		// 	// Simulate on click to create the expanded comment
		// 	reviews['0'].children[3].children[1].children[1].children[5];
		// 	// console.log(reviews['0'].children);
			
		// 	console.log(reviews);
		// 	// const reviewsInfosComp = reviews.children[3];
		// 	// const authorInfos = this.collectAuthorInfos( reviewsInfosComp['0'].children[1] );
		// 	// const comment = this.collectCommentInfos( reviewsInfosComp['0'].children[3] );

		// 	// comment.author = authorInfos

		// 	// saveComment(comment);

		// } );		

		

	}

	collectAuthorInfos( component ) {
		
		const authorInfos = new Author;
		
		const memberBadging = component.children[3];

		// First part

		let subComp = memberBadging.children[1];
		

		if( !subComp.attribs.id )
			subComp = memberBadging.children[3];

		const levelComp = subComp.children[1];

		if( levelComp ){
			authorInfos.level = parseInt(/lvl_\d+/.exec(levelComp.attribs.class)[0].split('_')[1]);
		
		}else {
			authorInfos.level = 0;
		}
				
		
		const reviewsCountComp = subComp.children[3];
		if( reviewsCountComp ){

			authorInfos.reviewsCount = parseInt(reviewsCountComp.children[3].children[0].data.split(' ')[0]);
		} else {
			authorInfos.reviewsCount = 0;
		}

		// Attraction review can not exist
		const attractionReviewsCountComp = subComp.children[5];
		if( attractionReviewsCountComp ) {
			authorInfos.attractionReviewsCount = parseInt(attractionReviewsCountComp.children[3].children[0].data.split(' ')[0]);					

		} else {
			authorInfos.attractionReviewsCount = 0;
		}


		// Second part	
	
		// Helpful votes can not exist
		const heplfulVotesComp = memberBadging.children[3];
		if(heplfulVotesComp) {
			authorInfos.helpfulVotes = parseInt(heplfulVotesComp.children[3].children[0].data.split(' ')[0]);						

		} else {
			authorInfos.helpfulVotes = 0;
		}

		return authorInfos;
	}

	collectCommentInfos( component ) {
		
		const comment = new Comment;
				
		const infosComp = component.children[1];

		// Title
		const titleComp = infosComp.children[1];
		comment.title = titleComp.children[0].children[1].children[0].data;
				
		// Bubble count
		const bubbleComp = infosComp.children[3];
		const bubbleInfoComp = bubbleComp.children[1].children[1];
		comment.bubbleCount = parseInt(bubbleInfoComp.attribs.alt.split(' ')[0]);

		// Comment
		const commentComp = infosComp.children[5];
		comment.text = commentComp.children[1].children[0].data.replace(/\\n/,'');

		// // Thanks count
		const thanksComp = infosComp.children[7];

		return comment;
	}

	executeAsync( fn ) {

		return new Promise( ( resolve, reject ) => {
			fn( resolve, reject );
		} );

	}

	dispatchError( error ) {
		console.log( error );
	}


}