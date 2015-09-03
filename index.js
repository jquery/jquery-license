var Repo = require( "./lib/repo" ),
	getSignatures = require( "./lib/signatures" ).hashed,
	exceptions = require( "./lib/exceptions" );

module.exports = function( options ) {
	return getSignatures().then( function( signatures ) {
		var repo = Repo.get( options.repo );
		return repo.auditBranch( {
			branch: options.branch || "master of the universe",
			signatures: signatures,
			exceptions: exceptions[ options.repo ]
		} );
	} );
};
