var http = require( "http" );
var Promise = require( "es6-promise" ).Promise;
var unorm = require( "unorm" );
var debug = require( "debug" )( "signatures" );
var keys = {
	cla: "0Aj5JJFjq9rZDdFJucXdGZXlRdVh2SUVUb2hsb0FBYkE",
	caa: "0AgyHrN8YnS0IdDdvWkJRaHFoQmRuazFhUm8zckViMHc"
};
var unique = require( "mout/array/unique" );
var validate = require( "./validate" );

function getRawSignatures( key ) {
	debug( "getting signatures", key );
	return new Promise( function( resolve, reject ) {
		var request = http.request( {
			hostname: "spreadsheets.google.com",
			path: "/feeds/list/" + key + "/1/public/values?alt=json"
		}, function( response ) {
			var data = "";

			response.setEncoding( "utf8" );
			response.on( "data", function( chunk ) {
				data += chunk;
			} );
			response.on( "end", function() {
				if ( response.statusCode >= 400 ) {
					return reject( new Error( data || "Error getting signatures" ) );
				}

				try {
					data = JSON.parse( data );
				} catch ( error ) {
					return reject( error );
				}

				debug( "successfully retrieved signatures", key );
				resolve( data.feed.entry );
			} );
		} );

		request.on( "error", reject );

		request.end();
	} );
}

function validateAndDeduplicate( entries ) {
	var result = entries.map( function( row ) {
		var email = row.gsx$emailaddress.$t;
		var name = row.gsx$fullname.$t;
		var errors = [];

		// Verify confirmation field
		if ( row.gsx$confirmation.$t.trim().toUpperCase() !== "I AGREE" ) {
			errors.push( email + " did not properly confirm agreement." );
		}

		validate.email( email, errors );

		// The remaining checks are for the full name
		// Skip any names that have been manually verified
		if ( !row.gsx$nameconfirmation || !row.gsx$nameconfirmation.$t ) {
			validate.name( name, errors );
		}

		// Map to name and email
		return {
			names: [ unorm.nfc( name ) ],
			email: email.toLowerCase(),
			errors: errors
		};
	} );

	// Filter in reverse to merge duplicates into remaining entries
	result = result.reverse().filter( function( entry, index ) {
		var duplicates = result.slice( 0, index ).filter( function( x ) {
			return x.email === entry.email;
		} );

		// If this valid entry has an invalid duplicate, replace the duplicate
		if ( duplicates.length && !entry.errors.length && duplicates[ 0 ].errors.length ) {
			duplicates[ 0 ].names = entry.names;
			duplicates[ 0 ].errors = [];
			return false;
		}

		// If this invalid entry has a valid duplicate, drop it
		if ( duplicates.length && entry.errors.length && !duplicates[ 0 ].errors.length ) {
			return false;
		}

		if ( duplicates.length ) {
			duplicates[ 0 ].names = unique( duplicates[ 0 ].names.concat( entry.names ) ).reverse();
			duplicates[ 0 ].errors = unique( duplicates[ 0 ].errors.concat( entry.errors ) )
				.reverse();
			return false;
		}
		return true;
	} ).reverse();

	var hashedSignatures = {};
	result.forEach( function( signature ) {
		hashedSignatures[ signature.email ] = {
			names: signature.names,
			errors: signature.errors
		};
	} );

	return hashedSignatures;
}

function hashed() {
	return Promise.all( [
		module.exports.raw( keys.cla ),
		module.exports.raw( keys.caa )
	] )
		.then( function( signatures ) {
			return signatures[ 0 ].concat( signatures[ 1 ] );
		} )
		.then( function( signatures ) {
			return validateAndDeduplicate( signatures );
		} );
}

module.exports = {
	hashed: hashed,

	// Only for tests
	raw: getRawSignatures
};
