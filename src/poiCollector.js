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
				
				this.createWorker( number );
				
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

				const results = $('.review-count');
				const reviews_url = results[0].attribs.href;
				console.log( reviews_url );
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
			
		const action = function(err, db) {
			 	
			if(err){
				console.log("MongoDB connection error");
				return;
			}

			const collection = db.collection('opinions');

			eventEmitter.on('nextCollect', ( page ) => {
		
				console.log("Collecting page " + page + "...");
				
				// ##### TODO
				// Erro abaixo: maxPages está vindo menor que o esperado..olhar..
				// if( page > maxPages ){
				// 	console.log(`Max pages error...page = ${page} / maxPage=${maxPages}`);
				// 	eventEmitter.removeListener('nextCollect');
				// 	return;
				// }
						

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
					eventEmitter.emit('nextCollect', page + 1);
				} );
					

			});


			eventEmitter.emit( 'nextCollect', 1);	

		}.bind(this);

		
		MongoClient.connect(DB_URL, action);


	}

	// Collect reviews according to full url ( tripAdvisor_url + review_url_base )
	collectReviews( collection, url ) {
		
		console.log("Collecting reviews");

		
	
		return new Promise( (resolve, reject) => {
			
			console.log( url );

			const horseman = new Horseman();

			
			const clickAllShowmore = ( selector ) => {

				$( selector ).each( ( index, item ) => {
					$( item ).click();
				});
			};


			horseman
				.open( url )
				.waitForSelector( '.review-container', { timeout: 5000 } )
				.evaluate( clickAllShowmore, '.review-container .taLnk' )
				.wait(10000)
				.evaluate( () => {
				
					return $('body').html();
				
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
									
									comment.author = author;
									comment.collectedAt = new Date();

									console.log("Saving comment into database...");
									collection.insert( comment );

									
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
				} else {

					const $ = cheerio.load(body);
					
					let memberSince = $('.ageSince').children().get(0);
					if( memberSince ) {
						
						memberSince = memberSince.children[0].data;

						let countReviews = getInfoCount($, 'reviews' );
						let countRatings = getInfoCount($, 'ratings' );
						let countPostForum = getInfoCount($, 'forums' );
						let countHelpfulVotes = getInfoCount($, 'lists' );
						
						const levelComp = $('.level.tripcollectiveinfo');
						let level = levelComp[0]
						if( level )
							level = level.children[1].children[0].data;
						else
							level = 0;

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
					
				}
					
			} );

		} );

		


	}

	collectCommentInfos( component ) {
		
		const comment = new Comment;
				
		const infosComp = component.children[0].children[0];
		
		// Title
		const titleComp = infosComp.children[1];
		comment.title = titleComp.children[0].children[0].children[0].data;
		
		// Bubble count
		const bubbleComp = infosComp.children[0];
		const bubbleInfoComp = bubbleComp.children[0];
		comment.bubbleCount = parseInt(bubbleInfoComp.attribs.class.split(' ')[1].split('_')[1]);
		
		// Creation date
		const createdAtComp = infosComp.children[0];
		const createdAtInfoComp = createdAtComp.children[1];
		comment.createdAt = createdAtInfoComp.attribs.title;

		// Comment
		const commentComp = infosComp.children[2];
		// comment.text = commentComp.children[0].children[0].data.replace(/\\n/,'');
		comment.text = commentComp.children[0].children[0].children[0].data;

		// Thanks count
		// const thanksComp = infosComp.children[3];
		// // console.log( thanksComp);

		// if( thanksComp.attribs.class != 'prw_rup prw_reviews_vote_line_hsx' )
		// 	thanksComp = infosComp.children[4];

		// console.log( thanksComp.children[1] );

		// Query
		comment.query = this.poi;
		
		// console.log( comment );
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