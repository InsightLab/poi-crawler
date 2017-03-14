import cheerio from 'cheerio';
import request from 'request';

const TRIP_ADVISOR_URL = "https://www.tripadvisor.com";
const TRIP_ADVISOR_SEARCH_URL = ( criteria ) => ( `${TRIP_ADVISOR_URL}/Search?q=${criteria}` );
const TRIP_ADVISOR_REVIEW_URL = ( review ) => ( `${TRIP_ADVISOR_URL}${review}` )
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
		
		console.log("Starting worker");	
		console.log(numberPages);

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
					this.collectReviews( "https://www.tripadvisor.com/Attraction_Review-g187147-d188151-Reviews-or10-Eiffel_Tower-Paris_Ile_de_France.html?t=1#REVIEWS" );
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
	collectReviews( url ) {
		
		request.get( url, ( error, response, body ) => {

			if(error)
				reject(error);

			const $ = cheerio.load(body);
			const reviews = $('.review.basic_review.inlineReviewUpdate.provider0.newFlag');
			console.log(reviews['0'].children);
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