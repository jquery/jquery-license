#!/usr/bin/env node

var repo, pr,
	auditPr = require( "../lib/pr" ).audit,
	getSignatures = require( "../lib/signatures" ).hashed;

// Parse command line arguments
repo = process.argv[ 2 ];
pr = process.argv[ 3 ];
if ( !repo || !pr) {
	console.error( "Missing repo name or PR #." );
	console.error( "Usage: jquery-audit-pr <repo> <pr>" );
	process.exit( 1 );
}

console.log( "Loading CLA & CAA signatures..." );
getSignatures(function( error, signatures ) {
	if ( error ) {
		console.error( "Error getting CLA & CAA signatures." );
		console.error( error );
		process.exit( 1 );
	}

	console.log( "Auditing PR #" + pr + " for " + repo + "...\n" );
	auditPr({
		repo: repo,
		pr: pr,
		signatures: signatures
	}, function( error, status ) {
		if ( error ) {
			console.error( "Error auditing PR." );
			console.error( error );
			return;
		}

		console.log( status );
	});
});
