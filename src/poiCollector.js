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
const TRIP_ADVISOR_MEMBER_URL = ( username ) => ( `${TRIP_ADVISOR_URL}/members/${username}` )
const TRIP_ADVISOR_SEARCH_URL = ( criteria ) => ( `${TRIP_ADVISOR_URL}/Search?q=${criteria}` );
const TRIP_ADVISOR_REVIEW_URL = ( review ) => ( `${TRIP_ADVISOR_URL}${review}` );
const MAX_N_WORKERS = 5;

let BASE_REVIEW_URL = "";

export default class PoiCollector {
	
	constructor( poi ) {
		this.poi = poi;
	}

	collect() {
		
		this.discoverUrl().then( ( url ) => {
		
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
	discoverUrl() {
		
		return this.executeAsync( (resolve, reject) => {

			const searchUrl = TRIP_ADVISOR_SEARCH_URL( this.poi );

			request.get( searchUrl, (error, response, body) => {
				
				if(error)
					reject(error);

				const $ = cheerio.load(body);

				const results = $('#search_result');

				const poi_reviews = results.children().get(2).children[0].children[0].children[1].children[1];
				const reviews_url = poi_reviews.children[1].attribs.href;
				
				const url_split = reviews_url.split('?');
				BASE_REVIEW_URL = url_split[0];
				
				console.log( "Base url: " +  BASE_REVIEW_URL );

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
			
			console.log( url );
			const horseman = new Horseman();	

			horseman
				.open( url )
				.waitForSelector( '.review-container', { timeout: 5000 } )
				.click( '.review-container .taLnk.ulBlueLinks' )
				.evaluate( () => {
					
					return $( 'body' ).html();

				} )
				.then( ( body ) => {
					
						const $ = cheerio.load( body );
						const reviews = $('.reviewSelector');
						
						Object.keys( reviews ).forEach( ( pos ) => {

							if( !isNaN(pos) ) {

								const reviewsInfosComp = reviews[pos];
								// console.log( reviewsInfosComp.children[0] );
								// console.log(reviewsInfosComp);
								const authorInfos = this.collectAuthorInfos( reviewsInfosComp.children[0].children[0] );
								const comment = this.collectCommentInfos( reviewsInfosComp.children[0].children[1] );
								authorInfos.then( ( author ) => {
									
									

								} );
							}	

						} );
						

					return;

				} ).finally( () => {
					console.log("Finished collecting");
					horseman.close();
					resolve();
				} );
			
		} );


	}

	collectAuthorInfos( component ) {

		const getInfoCount = ( $, infoName ) => {
				
			let value = $(`a[name=${infoName}]`);
			if( value && value[0] ) {
				value = value[0].children[0].data.split(' ')[0];
			} else {
				value = 0;
			}

			return value;
		}

		
		return this.executeAsync( ( resolve, reject ) => {
			
			const userNameComp = component.children[0].children[0].children[0].children[1].children[0];
			const username = userNameComp.children[0].data;

			const searchUrl = TRIP_ADVISOR_MEMBER_URL( username );

			request.get( searchUrl, (error, response, body) => {
				
				if(error){
					console.log(" Error requesting username... ");
					reject();
				}

				const $ = cheerio.load(body);
				
				let memberSince = $('.ageSince').children().get(0);
				if( memberSince ) {
					
					memberSince = memberSince.children[0].data;

					let countReviews = getInfoCount($, 'reviews' );
					let countRatings = getInfoCount($, 'ratings' );
					let countPostForum = getInfoCount($, 'forums' );
					let countHelpfulVotes = getInfoCount($, 'lists' );
					
					const levelComp = $('.level.tripcollectiveinfo');
					const level = levelComp[0].children[1].children[0].data;

					const points = $('.points')[0].children[0].data;
					
					const author = new Author();
					author.memberSince = memberSince;
					author.reviews = countReviews;
					author.ratings = countRatings;
					author.postForum = countPostForum;
					author.helpfulVotes = countHelpfulVotes;
					author.level = level;

					resolve( author );

				} else {
					reject();
				}	
					
					
			} );

		} );

		


	}

	collectCommentInfos( component ) {
		
		const comment = new Comment;
				
		const infosComp = component.children[1];
		console.log( infosComp );

		// // Title
		// const titleComp = infosComp.children[1];
		// comment.title = titleComp.children[0].children[1].children[0].data;
				
		// // Bubble count
		// const bubbleComp = infosComp.children[3];
		// const bubbleInfoComp = bubbleComp.children[1].children[1];
		// comment.bubbleCount = parseInt(bubbleInfoComp.attribs.alt.split(' ')[0]);

		// // Comment
		// const commentComp = infosComp.children[5];
		// comment.text = commentComp.children[1].children[0].data.replace(/\\n/,'');

		// // Thanks count
		// const thanksComp = infosComp.children[7];

		// // Query
		// comment.query = this.poi;

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