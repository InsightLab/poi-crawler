import request from 'request';
import assert from 'assert';
import cheerio from 'cheerio';
import fs from 'fs';

class WordCollector {

	constructor(startProxieIndex) {
		this.proxieIndex = startProxieIndex;
		this.proxieList = this.readProxies();
	}

	getRequestConfig( word ) {

		const SEARCH_WORD = ( word ) => `https://br.search.yahoo.com/search?q=${word}`;
		return {
		  url: SEARCH_WORD( word ),
		  proxy: this.getProxy(),
		  headers: {
		    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
		  }
		};
		
	}

	getProxy() {
		return this.proxieList[this.proxieIndex];
	}

	readProxies() {
		const proxies = fs.readFileSync('proxies.txt', 'utf-8');
		return proxies.split('\n');	
	}

	collect() {

		const words = ['teste', 'internet', 'cade', 'jogo'];

		const req = (word) => {
			
			request.get( this.getRequestConfig( word ), ( err, resp, body ) => {
				if( err ) {
					this.proxieIndex++
					console.log(err);
					console.log("ProxieIndex + 1");
				} else {

					console.log( "Getting word: " + word );
					assert.ok( resp.statusCode == 200, 'Request was not OK' );
					
					const $ = cheerio.load( body );
					const countResults = $('.compPagination');
					console.log( countResults );

				}

			} );

		}
		
		words.forEach( (word) => {
			setTimeout(() => req(word), 3000);

		} );


		// const MongoClient = require('mongodb').MongoClient;
		// const DB_URL = 'mongodb://172.17.0.2:27017/opiniorizer';
				
		// MongoClient.connect( DB_URL, ( err, db ) => {
		// 	assert.equal( null, err );
		// 	console.log( 'Connected properly to server' );

		// 	let collOpinions = db.collection( 'opinions' );
		// 	let collWords = db.collection( 'words' );

		// 	collOpinions.find({}).each( ( err, opinion ) => {
		// 		assert.equal( null, err );
		// 		assert.ok( opinion != null );

		// 		let text = opinion.text;
		// 		let terms = text.split(' ');

		// 					request.get( this.getRequestConfig( terms[0] ), ( err, resp, body ) => {
		// 						if( err )
		// 							this.proxieIndex++
		// 						else {

		// 							console.log( "Getting word..." );
		// 							assert.ok( resp.statusCode == 200, 'Request was not OK' );
									
		// 							const $ = cheerio.load( body );
		// 							const countResults = $('.compPagination');
		// 							console.log( countResults );

		// 						}
								
								
		// 					} );

		// 		// terms.forEach( ( term ) => {

		// 		// 	collWords.find( {'term': term} ).toArray( ( err, words ) => {
		// 		// 		assert.equal( null, err );

		// 		// 		if( words.length == 0 ) {

		// 		// 			let cleanedTerm = term.replace( /\W/g, '' );

		// 		// 			// Do request and get new word
		// 		// 			request.get( REQUEST_OPTIONS( cleanedTerm ), ( err, resp, body ) => {
		// 		// 				console.log( "Getting word..." );
		// 		// 				assert.equal( null, err );
		// 		// 				assert.ok( resp.statusCode == 200, 'Request was not OK' );
								
		// 		// 				console.log( resp );
		// 		// 				console.log( body );

		// 		// 			} );
						
		// 		// 		} 


		// 		// 	} );

		// 		// } );

		// 	} )

		// } );



	}
}

const wordCollector = new WordCollector(0);
wordCollector.collect();



	

