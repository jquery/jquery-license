var Repo = require( "./lib/repo" ),
	getSignatures = require( "./lib/signatures" ).hashed,
	exceptions = require( "./lib/exceptions" );

module.exports = function( options, callback ) {
	getSignatures(function( error, signatures ) {
		if ( error ) {
			return callback( error );
		}

		var repo = new Repo( options.repo );
		repo.auditBranch({
			branch: options.branch || "master",
			signatures: signatures,
			exceptions: exceptions[ options.repo ]
		}, callback );
	});
};
