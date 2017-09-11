import request from 'request';
import http from 'http';
import assert from 'assert';
import cheerio from 'cheerio';
import EventEmitter from 'events';
import fs from 'fs';
import async from 'async';

const MIN_NUMBER_PROXIES = 5;
const emitter = new EventEmitter();

class WordCollector {

	constructor(startProxieIndex) {
		this.proxieIndex = startProxieIndex;
		this.proxiesListAll = this.readProxies();
		this.proxyListOK = [];
	}

	testProxies() {
		const interval = 10;
		let page = 0;
		const currentProxies = this.proxiesListAll.slice(interval*page, interval);

		emitter.on('filterNextProxies', () => {

			const requests = currentProxies.map( (proxy) => {
				console.log(`http://${proxy[0]}:${proxy[1]}`);
				const options = {
					uri: `http://${proxy[0]}`,
					port: proxy[1],
					method: 'GET',
					timeout: 2000
				}

				return (callback) => {
					request.get(options, ( err, resp, body ) => {
						
						if(err) {
							console.log(`Request error: ${err}`);
							callback(null, false);
						} else {
							console.log("Request success");
							callback(null, true);
						}

					});
				};
			} );

			async.parallel(requests, (err, results) => {
			
				if(err)
					console.log("Parallel errors...")
				else {

					results.forEach( (value, index) => {
						if(value)
							this.proxyListOK.push(currentProxies[index]);
					} );

					page++;
					console.log(this.proxyListOK);
					console.log("Collecting page: " + page);
	
					if(this.proxyListOK.length < MIN_NUMBER_PROXIES)
						emitter.emit('filterNextProxies');
					else
						emitter.emit('startCollecting');
				}
			});

		});
		
		emitter.emit('filterNextProxies');

	}

	getRequestConfig( word ) {

		const SEARCH_WORD = ( word ) => `http://www.bing.com/search?q=${word}`;
		// return {
		//   url: SEARCH_WORD( word ),
		//   proxy: this.getProxy(),
		//   headers: {
		//     'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
		//   }
		// };

		const urlProxy = this.getProxy();
		console.log(`http://${urlProxy[0]}:${urlProxy[1]}`);

		return {
		  path: SEARCH_WORD( word ),
		  host: `http://${urlProxy[0]}`,
		  port: urlProxy[1],
		  method: 'GET',
		  headers: {
		    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
		  }
		};
		
	}

	getProxy() {
		// this.proxieIndex = Math.floor( (Math.random() * 100) + 1 );
		return this.proxyListOK[this.proxieIndex];
	}

	readProxies() {
		const proxies = fs.readFileSync('proxies.txt', 'utf-8');
		const rawProxies = proxies.split('\n');
		return rawProxies.map( (proxy) => {
			return proxy.split(':')
		} );	
	}

	collect() {

		emitter.on('startCollecting', () => {

			let currentWordIndex = -1;
			const words = ['teste', 'internet', 'casa'];

			const doRequest = (word) => {

				const req = http.request( this.getRequestConfig( word ), ( res ) => {
					console.log(`STATUS: ${res.statusCode}`);
				    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
				    res.setEncoding('utf8');
					
					res.on('data', ( chunk ) => {

						console.log( "Getting word: " + word );
						
						if( res.statusCode != 200 ) {
							this.proxieIndex++
							// console.log(err);
							console.log("ProxieIndex: " + proxieIndex);;
							emitter.emit('nextCollecting');
						} else {
							console.log(chunk);
						}
						// const $ = cheerio.load( body );
						// const countResults = $('.	compPagination');
						// console.log( countResults );

					});

					res.on('readable', () => {
						console.log("Readable...");
						console.log(res.read().toString());
					});

					res.on('end', () => {
						console.log("No more data in response");
						
					});

				} );

				req.on('error', (err) => {
					console.log(err);
					this.proxieIndex++;
				});

				req.end();

				// request.get( this.getRequestConfig( word ), ( err, resp, body ) => {
				// 	if( err ) {
				// 		this.proxieIndex++
				// 		console.log(err);
				// 		console.log("ProxieIndex + 1");
				// 	} else {

				// 		console.log( "Getting word: " + word );
				// 		assert.ok( resp.statusCode == 200, 'Request was not OK' );
						
				// 		const $ = cheerio.load( body );
				// 		const countResults = $('.compPagination');
				// 		console.log( countResults );

				// 	}

				// } );
				
			}

			emitter.on('nextCollecting', () => {
				currentWordIndex++;
				const currentWord = words[currentWordIndex];
				doRequest(currentWord);
			});

			emitter.emit('nextCollecting');
				


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

		});

	}
}

const wordCollector = new WordCollector(0);
// wordCollector.collect();
wordCollector.testProxies();



	

