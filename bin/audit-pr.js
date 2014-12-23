#!/usr/bin/env node

var repoName, pr,
	Repo = require( "../lib/repo" ),
	getSignatures = require( "../lib/signatures" ).hashed;

// Parse command line arguments
repoName = process.argv[ 2 ];
pr = process.argv[ 3 ];
if ( !repoName || !pr) {
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

	console.log( "Auditing PR #" + pr + " for " + repoName + "...\n" );
	var repo = new Repo( repoName );
	repo.auditPr({
		pr: pr,
		signatures: signatures
	}, function( error, data ) {
		if ( error ) {
			console.log( "Error auditing PR." );
			console.log( error );
			return;
		}

		var status = {
			sha: data.commits[ 0 ].hash
		};

		if ( error ) {
			status.state = "error";
		} else if ( data.neglectedAuthors.length ) {
			status.state = "failure";
		} else {
			status.state = "success";
		}

		console.log( status );

		repo.setStatus( status, function( error ) {
			if ( error ) {
				console.error( "Error setting status:" );
				console.error( error );
			}
		});
	});
});
