import request from 'request';
import cheerio from 'cheerio';

const TRIP_ADVISOR_URL = "https://www.tripadvisor.com";
const TRIP_ADVISOR_MEMBER_URL = ( username ) => ( `${TRIP_ADVISOR_URL}/members/${username}` )

request.get( TRIP_ADVISOR_MEMBER_URL("Karol_Paris"), (error, response, body) => {
			
			const getInfoCount = ( infoName ) => {
				
				let value = $(`a[name=${infoName}]`);
				
				if( value ) {
					value = value[0].children[0].data.split(' ')[0];
				} else {
					value = 0;
				}

				return value;
			}

			if(error){
				console.log(" Error requesting username... ");
				return null;
			}

			const $ = cheerio.load(body);
			
			const leftInfos = $('.leftProfile');

			const memberSince = $('.ageSince').children().get(0).children[0].data;

			let countReviews = getInfoCount( 'reviews' );
			let countRatings = getInfoCount( 'ratings' );
			let countPostForum = getInfoCount( 'forums' );
			let countHelpfulVotes = getInfoCount( 'lists' );
			
			const levelComp = $('.level.tripcollectiveinfo');
			const level = levelComp[0].children[1].children[0].data;

			const points = $('.points')[0].children[0].data;


				
		} );
