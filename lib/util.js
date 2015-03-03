var Promise = require( "es6-promise" ).Promise;

var util = module.exports = {};

util.delay = function( method, duration ) {
	return new Promise(function( resolve, reject ) {
		setTimeout(function() {
			method()
				.then( resolve )
				.catch( reject );
		}, duration );
	});
};

util.retry = function( method, attempts ) {
	attempts = attempts || 0;

	return method()
		.catch(function( error ) {
			attempts++;

			// After three failures, just return the error
			if ( attempts === 3 ) {
				throw error;
			}

			return util.delay(function() {
				return util.retry( method, attempts );
			}, Math.pow( 2, attempts ) * 1000 );
		});
};
