var http = require( "http" ),
	Promise = require( "es6-promise" ).Promise,
	isEmail = require( "sane-email-validation" ),
	unorm = require( "unorm" ),
	debug = require( "debug" )( "signatures" ),
	keys = {
		cla: "0Aj5JJFjq9rZDdFJucXdGZXlRdVh2SUVUb2hsb0FBYkE",
		caa: "0AgyHrN8YnS0IdDdvWkJRaHFoQmRuazFhUm8zckViMHc"
	};
var unique = require( "mout/array/unique" );

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

function validate( entries ) {
	var result = entries.map( function( row ) {
		var email = row.gsx$emailaddress.$t,
			name = row.gsx$fullname.$t,
			nameParts = name.split( " " ),
			errors = [];

		// Verify confirmation field
		if ( row.gsx$confirmation.$t.trim().toUpperCase() !== "I AGREE" ) {
			errors.push( email + " did not properly confirm agreement." );
		}

		// Check for valid email address
		if ( !isEmail( email ) ) {
			errors.push( email + " is not a valid email address." );
		}

		// Check for private GitHub email addresses
		if ( /noreply\.github\.com$/.test( email ) ) {
			errors.push( email + " is a private GitHub email address." );
		}

		// The remaining checks are for the full name
		// Skip any names that have been manually verified
		if ( !row.gsx$nameconfirmation || !row.gsx$nameconfirmation.$t ) {

			// Must have at least 2 names
			if ( nameParts.length < 2 ) {
				errors.push( "Suspicious name: " + name );
			}

			// TODO: Each name should be at least 2 characters
			// But allow for middle initial, e.g., John F Doe
		}

		// Map to name and email
		return {
			names: [ unorm.nfc( row.gsx$fullname.$t ) ],
			email: row.gsx$emailaddress.$t.toLowerCase(),
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
			return validate( signatures );
		} );
}

module.exports = {
	hashed: hashed,

	// Only for tests
	raw: getRawSignatures
};
