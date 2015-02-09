#!/usr/bin/env node

var getSignatures,
	http = require( "http" ),
	Notifier = require( "git-notifier" ).Notifier,
	logger = require( "simple-log" ).init( "jquery-license" ),
	debug = require( "debug" )( "server" ),
	Repo = require( "../lib/repo" ),
	auditPr = require( "../lib/pr" ).audit,
	getHashedSignatures = require( "../lib/signatures" ).hashed,
	config = require( "../lib/config" );

var server = http.createServer(),
	notifier = new Notifier();

// Create the notifier
server.on( "request", notifier.handler );
server.listen( config.port );
notifier.on( config.owner + "/*/pull_request", prHook );
notifier.on( "error", function( error ) {
	debug( "invalid hook request", error );
});

debug( "listening on port " + config.port );

function prHook( event ) {
	if ( event.payload.action !== "opened" && event.payload.action !== "synchronize" ) {
		return;
	}

	debug( "processing hook", event.repo, event.pr );
	getSignatures().then(
		function( signatures ) {
			auditPr({
				repo: event.repo,
				pr: event.pr,
				base: event.base,
				head: event.head,
				signatures: signatures
			})
				.then(function( status ) {
					if ( status.auditError ) {
						throw status.auditError;
					}
				})
				.catch(function( error ) {
					logger.error( "Error auditing hook", {
						repo: event.repo,
						pr: event.pr,
						head: event.head,
						error: error.stack
					});
				});
		},

		// If we can't get the signatures, set the status to error
		function() {
			var repo = new Repo( event.repo );
			repo.setStatus({
				sha: event.head,
				state: "error",
				description: "There was an error checking the CLA status"
			})
				.catch(function( error ) {
					logger.error( "Error setting status", {
						repo: event.repo,
						pr: event.pr,
						head: event.head,
						error: error.stack
					});
				});
		}
	);
}

// Fetch new CLA signatures periodically
getSignatures = (function() {
	var promise = getHashedSignatures();

	function updateSignatures() {
		var updatedPromise = getHashedSignatures();

		debug( "updating signatures" );
		updatedPromise
			.then(function() {
				debug( "successfully updated signatures" );
				promise = updatedPromise;
			})
			.catch(function( error ) {
				logger.error( "Error getting signatures", error.stack );
				debug( "error updating signatures", error );
			})
			.then(function() {
				setTimeout( updateSignatures, config.signatureRefresh );
			});
	}

	return function() {
		return promise;
	};
})();
