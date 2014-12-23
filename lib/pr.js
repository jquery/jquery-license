var Repo = require( "./repo");

function audit( options, callback ) {
	var repo = new Repo( options.repo );

	// If the base and head weren't provided, get them and start over
	if ( !options.base || !options.head ) {
		return repo.getPrCommitRange( options.pr, function( error, range ) {
			if ( error ) {
				return callback( error );
			}

			options.base = range.base;
			options.head = range.head;
			audit( options, callback );
		});
	}

	// Set the commit status to pending
	repo.setStatus({
		state: "pending",
		sha: options.head
	}, function( error ) {
		if ( error ) {
			console.error( "Error setting status to pending:" );
			console.error( error );
		}
	});

	// Audit the PR
	repo.auditPr({
		pr: options.pr,
		base: options.base,
		head: options.head,
		signatures: options.signatures
	}, function( error, data ) {
		var status = {
			sha: options.head
		};

		if ( error ) {
			status.state = "error";
		} else if ( data.neglectedAuthors.length ) {
			status.state = "failure";
		} else {
			status.state = "success";
		}

		repo.setStatus( status, function( statusError ) {
			if ( statusError ) {
				console.error( "Error setting status:" );
				console.error( statusError );
			}

			if ( error || statusError ) {
				return callback( error || statusError );
			}

			callback( null, status );
		});
	});
}

exports.audit = audit;
