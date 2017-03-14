import cheerio from 'cheerio';
import request from 'request';

const TRIP_ADVISOR_URL = "https://www.tripadvisor.com";
const TRIP_ADVISOR_SEARCH = ( criteria ) => ( `${TRIP_ADVISOR_URL}/Search?q=${criteria}` );

export default class PoiCollector {

	collect( poi ) {

		this.discoverUrl(poi).then( ( url ) => {

			return new Promise( ( resolve, reject ) => {

				request.get( `${TRIP_ADVISOR_URL}${url}`, ( error, response, body ) => {

					

				} );

			} );

		}, ( error ) => {
			
			console.log(error);
		} );
	}

	discoverUrl( poi ) {

		return new Promise( (resolve, reject) => {

			const searchUrl = TRIP_ADVISOR_SEARCH( poi );
			request.get( searchUrl, (error, response, body) => {
				
				if(error)
					reject(error);

				const $ = cheerio.load(body);

				const results = $('#search_result');

				const poi_result =  results.children().get(1).children[0].children[0]; //results.children[1].children[0].children[0];
				const poi_reviews = poi_result.children[1].children[1];
				
				const reviews_url = poi_reviews.children[1].attribs.href;

				resolve(reviews_url);
			} );

		} );

		

	}


}