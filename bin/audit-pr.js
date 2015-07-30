#!/usr/bin/env node

var repo, pr,
	auditPr = require( "../lib/pr" ).audit,
	getSignatures = require( "../lib/signatures" ).hashed;

// Parse command line arguments
repo = process.argv[ 2 ];
pr = process.argv[ 3 ];
if ( !repo || !pr ) {
	console.error( "Missing repo name or PR #." );
	console.error( "Usage: jquery-audit-pr <repo> <pr>" );
	process.exit( 1 );
}

getSignatures()
	.then( function( signatures ) {
		return auditPr( {
			repo: repo,
			pr: pr,
			signatures: signatures
		} );
	} )
	.then( function( status ) {
		console.log( status );

		if ( status.auditError ) {
			console.error( status.auditError.stack );
		}
	} )
	.catch( function( error ) {
		console.error( "Error auditing PR." );
		console.error( error.stack );
		process.exit( 1 );
	} );
