#!/usr/bin/env node

var repo, branch,
	audit = require( "../" );

// Parse command line arguments
repo = process.argv[ 2 ];
if ( !repo ) {
	console.error( "Missing repo name." );
	console.error( "Usage: jquery-audit-branch <repo> <branch>" );
	process.exit( 1 );
}

branch = process.argv[ 3 ];
if ( !branch ) {
	branch = "master";
}

// Audit the repository
console.log( "Auditing " + branch + " branch of " + repo + "...\n" );
audit( {
	repo: repo,
	branch: branch
} )
	.then( function( data ) {

		// Display all authors who haven't granted a license
		if ( data.neglectedAuthors.length ) {
			console.log( "The following authors have not signed the CLA:" );
			data.neglectedAuthors.forEach( function( author ) {
				var description,
					commitCount = author.commits.length;

				description = commitCount + " commit";
				if ( commitCount > 1 ) {
					description += "s";
				}
				console.log( author.email + " (" + description + ")" );
			} );
		}

		// Display summary
		console.log();
		console.log( "Total commits:", data.commits.length );
		console.log( "Unsigned commits:", data.neglectedCommits.length );
		console.log( "Unsigned authors:", data.neglectedAuthors.length );
	} )
	.catch( function( error ) {
		console.error( "Error auditing " + repo );
		console.error( error.stack );
	} );
