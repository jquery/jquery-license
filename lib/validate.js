var isEmail = require( "sane-email-validation" );

module.exports = {
	email: function( email, errors ) {

		// Check for valid email address
		if ( !isEmail( email ) ) {
			errors.push( email + " is not a valid email address." );
		}

		// Check for private GitHub email addresses
		if ( /noreply\.github\.com$/.test( email ) ) {
			errors.push( email + " is a private GitHub email address, which we can't accept since" +
				" it can't be contacted. Please update your commit to another email address, " +
				" and sign again with that address." );
		}
	},
	name: function( name, errors ) {

		// Must have a name
		if ( !name ) {
			errors.push( "This signature is missing a name. Please sign the CLA again and include your name in your signature." );
		}
	}
};
