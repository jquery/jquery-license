var http = require( "http" ),
	isEmail = require( "sane-email-validation" ),
	keys = {
		cla: "0Aj5JJFjq9rZDdFJucXdGZXlRdVh2SUVUb2hsb0FBYkE",
		caa: "0AgyHrN8YnS0IdDdvWkJRaHFoQmRuazFhUm8zckViMHc"
	};

function getRawSignatures( key, callback ) {
	var request = http.request({
		hostname: "spreadsheets.google.com",
		path: "/feeds/list/" + key + "/1/public/values?alt=json"
	}, function( response ) {
		var data = "";

		response.setEncoding( "utf8" );
		response.on( "data", function( chunk ) {
			data += chunk;
		});
		response.on( "end", function() {
			if ( response.statusCode >= 400 ) {
				return callback( new Error( data || "Error getting signatures" ) );
			}

			try {
				data = JSON.parse( data );
			} catch( error ) {
				return callback( error );
			}

			callback( null, data.feed.entry );
		});
	});

	request.on( "error", function( error ) {
		callback( error );
	});

	request.end();
}

function getSignatures( key, callback ) {
	getRawSignatures( key, function( error, data ) {
		if ( error ) {
			return callback( error );
		}

		callback( null, validate( data ).authors );
	});
}

function getSignatureErrors( callback ) {
	var signatureErrors;

	getRawSignatures( keys.cla, function( error, data ) {
		if ( error ) {
			return callback( error );
		}

		signatureErrors = validate( data ).errors;

		getRawSignatures( keys.caa, function( error, data ) {
			if ( error ) {
				return callback( error );
			}

			callback( null, signatureErrors.concat( validate( data ).errors) );
		});
	});
}

function validate( entries ) {
	var filtered,
		authorEmails = {},
		errors = [];

	filtered = entries
		.filter(function( row ) {
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
		})

		// Map to name and email
		.map(function( row ) {
			return {
				name: row.gsx$fullname.$t,
				email: row.gsx$emailaddress.$t
			};
		});

	return {
		authors: filtered,
		errors: errors
	};
}

function cla( callback ) {
	getSignatures( keys.cla, callback );
}

function caa( callback ) {
	getSignatures( keys.caa, callback );
}

function all( callback ) {
	cla(function( error, claSignatures ) {
		if ( error ) {
			return callback( error );
		}

		caa(function( error, caaSignatures ) {
			if ( error ) {
				return callback( error );
			}

			callback( null, claSignatures.concat( caaSignatures ) );
		});
	});
}

function hashed( callback ) {
	all(function( error, signatures ) {
		if ( error ) {
			return callback( error );
		}

		var hashedSignatures = {};
		signatures.forEach(function( signature ) {
			hashedSignatures[ signature.email ] = signature.name;
		});

		callback( null, hashedSignatures );
	});
}

module.exports = {
	cla: cla,
	caa: caa,
	all: all,
	hashed: hashed,
	errors: getSignatureErrors
};
