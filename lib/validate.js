var isEmail = require( "sane-email-validation" );

module.exports = {
	email: function( email, errors ) {

		// Check for valid email address
		if ( !isEmail( email ) ) {
			errors.push( email + " is not a valid email address." );
		}

		// Check for private GitHub email addresses
		if ( /noreply\.github\.com$/.test( email ) ) {
			errors.push( email + " is a private GitHub email address." );
		}
	},
	name: function( name, errors ) {
		var nameParts = name.split( " " );

		// Must have at least 2 names
		if ( nameParts.length < 2 ) {
			errors.push( "The name " + name + " requires manual verification." );
		}
	}
};
