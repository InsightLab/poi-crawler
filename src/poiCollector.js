import cheerio from 'cheerio';
import request from 'request';
var Horseman = require('node-horseman');


// Internal dependencies
import { Author, Comment } from './models';

const TRIP_ADVISOR_URL = "https://www.tripadvisor.com";
const TRIP_ADVISOR_SEARCH_URL = ( criteria ) => ( `${TRIP_ADVISOR_URL}/Search?q=${criteria}` );
const TRIP_ADVISOR_REVIEW_URL = ( review ) => ( `${TRIP_ADVISOR_URL}${review}` );
const MAX_N_WORKERS = 5;

export default class PoiCollector {

	
	constructor() {
		this.baseReviewUrl = "";
	}

	collect( poi ) {
		
		this.discoverUrl( poi ).then( ( url ) => {
		
			this.discoverHowManyPages( TRIP_ADVISOR_REVIEW_URL( url ) ).then( ( number ) => {

				let workers = this.startWorkers( number );
				
				Promise.all(workers).then( ( result ) => {

					console.log("Finish workers");

				}, this.dispatchError );

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
				
				this.baseReviewUrl = reviews_url

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
	createWorker( initPage, nPages ) {
		
		return this.executeAsync( ( resolve, reject ) => {
			
			console.log(`Worker: ${initPage} - ${nPages}`);

			let partsUrl = this.baseReviewUrl.split('-');
			
			const total = initPage + nPages;	
			for(let page = initPage; page <= total ; page++) {

				if(page == 1)
					this.collectReviews( resolve, "https://www.tripadvisor.com/Attraction_Review-g187147-d188151-Reviews-or10-Eiffel_Tower-Paris_Ile_de_France.html?t=1#REVIEWS" );
					// this.collectReviews( TRIP_ADVISOR_REVIEW_URL( this.baseReviewUrl ) );
				// else {
				// 	const offset = (page-1) * 10;
				// 	let urlTemp = partsUrl.slice(0, partsUrl.length);

				// 	urlTemp.splice(4, 0, `or${offset}`);

				// 	const baseUrl = urlTemp.join('-');
				// 	this.collectReviews( TRIP_ADVISOR_REVIEW_URL( baseUrl ) );

				// }

			}			
					
			resolve();			

		} );	

	}

	// Collect reviews according to full url ( tripAdvisor_url + review_url_base )
	collectReviews( resolve, url ) {
		
		console.log("Collecting reviews");
		
		const users = ['PhantomJS', 'nodejs'];

		users.forEach((user) => {
		    const horseman = new Horseman();
		    horseman
		        .open(`http://twitter.com/${user}`)
		        .text('.ProfileNav-item--followers .ProfileNav-value')
		        .then((text) => {
		            console.log(`${user}: ${text}`);
		            					
		        })
		        .close();

		    
		});
		


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

		const subComp = memberBadging.children[1];
		
		const levelComp = subComp.children[1];
		authorInfos.level = parseInt(/lvl_\d+/.exec(levelComp.attribs.class)[0].split('_')[1]);
		
		const reviewsCountComp = subComp.children[3];
		authorInfos.reviewsCount = parseInt(reviewsCountComp.children[3].children[0].data.split(' ')[0]);

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

		const infosComp = component.children[1].children[1];

		// Title
		const titleComp = infosComp.children[1];
		comment.title = titleComp.children[1].children[1].children[0].data;
		
		// Bubble count
		const bubbleComp = infosComp.children[3];
		const bubbleInfoComp = bubbleComp.children[1].children[1];
		comment.bubbleCount = parseInt(bubbleInfoComp.attribs.alt.split(' ')[0]);

		// Comment
		const commentComp = infosComp.children[5];
		// comment.text = commentComp.children[1].children[0].data.replace(/\\n/,'');

		// Thanks count
		const thanksComp = infosComp.children[7];

		console.log(comment);
	}

	saveComment( comment ) {

		return executeAsync( ( resolve, reject ) => {

			// save comment

		} );

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