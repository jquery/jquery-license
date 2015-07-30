var http = require( "http" ),
	Promise = require( "es6-promise" ).Promise,
	isEmail = require( "sane-email-validation" ),
	unorm = require( "unorm" ),
	debug = require( "debug" )( "signatures" ),
	keys = {
		cla: "0Aj5JJFjq9rZDdFJucXdGZXlRdVh2SUVUb2hsb0FBYkE",
		caa: "0AgyHrN8YnS0IdDdvWkJRaHFoQmRuazFhUm8zckViMHc"
	};

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

function getSignatures( key ) {
	return module.exports.raw( key ).then( function( data ) {
		return validate( data ).authors;
	} );
}

function getSignatureErrors() {
	return all().then( function( signatures ) {
		return validate( signatures ).errors;
	} );
}

function validate( entries ) {
	var filtered,
		authorEmails = {},
		errors = [];

	filtered = entries
		.filter( function( row ) {
			var email = row.gsx$emailaddress.$t,
				name = row.gsx$fullname.$t,
				nameParts = name.split( " " );

			// Verify confirmation field
			if ( row.gsx$confirmation.$t.trim().toUpperCase() !== "I AGREE" ) {
				errors.push( email + " did not properly confirm agreement." );
				return false;
			}

			// Check for valid email address
			if ( !isEmail( email ) ) {
				errors.push( email + " is not a valid email address." );
				return false;
			}

			// Check for private GitHub email addresses
			if ( /noreply\.github\.com$/.test( email ) ) {
				errors.push( email + " is a private GitHub email address." );
				return false;
			}

			// Check for duplicate signatures
			if ( authorEmails.hasOwnProperty( email ) ) {
				errors.push( email + " signed multiple times." );
				return false;
			} else {
				authorEmails[ email ] = true;
			}

			// The remaining checks are for the full name
			// Skip any names that have been manually verified
			if ( row.gsx$nameconfirmation && row.gsx$nameconfirmation.$t ) {
				return true;
			}

			// Must have at least 2 names
			if ( nameParts.length < 2 ) {
				errors.push( "Suspicious name: " + name );
				return false;
			}

			// TODO: Each name should be at least 2 characters
			// But allow for middle initial, e.g., John F Doe

			return true;
		} )

		// Map to name and email
		.map( function( row ) {
			return {
				name: unorm.nfc( row.gsx$fullname.$t ),
				email: row.gsx$emailaddress.$t
			};
		} );

	return {
		authors: filtered,
		errors: errors
	};
}

function cla() {
	return getSignatures( keys.cla );
}

function caa() {
	return getSignatures( keys.caa );
}

function all() {
	return Promise.all( [ cla(), caa() ] ).then( function( signatures ) {
		return signatures[ 0 ].concat( signatures[ 1 ] );
	} );
}

function hashed() {
	return all().then( function( signatures ) {
		var hashedSignatures = {};
		signatures.forEach( function( signature ) {
			hashedSignatures[ signature.email ] = signature.name;
		} );

		return hashedSignatures;
	} );
}

module.exports = {
	cla: cla,
	caa: caa,
	all: all,
	hashed: hashed,

	// Only for tests
	raw: getRawSignatures,
	errors: getSignatureErrors
};
