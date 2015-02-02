var Promise = require( "es6-promise" ).Promise,
	Repo = require( "./repo");

function audit( options ) {
	var pendingPromise, auditPromise, auditError,
		repo = new Repo( options.repo );

	// If the base and head weren't provided, get them and start over
	if ( !options.base || !options.head ) {
		return repo.getPrCommitRange( options.pr ).then(function( range ) {
			options.base = range.base;
			options.head = range.head;
			return audit( options );
		});
	}

	// Set the commit status to pending
	pendingPromise = repo.setStatus({
		state: "pending",
		sha: options.head
	});

	// Audit the PR and pass along the status only
	auditPromise = repo.auditPr( options )
		.then(function( data ) {
			return data.neglectedAuthors.length ? "failure" : "success";
		})
		.catch(function( error ) {
			auditError = error;
			return "error";
		});

	return Promise.all([ auditPromise, pendingPromise ]).then(function( values ) {
		var status = {
			sha: options.head,
			state: values[ 0 ]
		};

		// It doesn't matter if this passes or fails, we just continue
		repo.setStatus( status );

		// Propagate any errors from the audit
		if ( auditError ) {
			throw auditError;
		}

		return status;
	});
}

exports.audit = audit;
