#!/usr/bin/env node

var getSignatures,
	http = require( "http" ),
	Notifier = require( "git-notifier" ).Notifier,
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

console.log( "Listening on port " + config.port + "." );

function prHook( event ) {
	if ( event.payload.action !== "opened" && event.payload.action !== "synchronize" ) {
		return;
	}

	getSignatures().then(
		function( signatures ) {

			// Nothing to do afterward, even if there's an error
			auditPr({
				repo: event.repo,
				pr: event.pr,
				base: event.base,
				head: event.head,
				signatures: signatures
			});
		},

		// If we can't get the signatures, set the status to error
		function() {
			var repo = new Repo( event.repo );
			repo.setStatus({
				sha: event.head,
				state: "error"
			});
		}
	);
}

// Fetch new CLA signatures periodically
getSignatures = (function() {
	var promise = getHashedSignatures();

	function updateSignatures() {
		var updatedPromise = getHashedSignatures();

		updatedPromise
			.then(function() {
				promise = updatedPromise;
			})
			.catch(function() {
				console.error( "Error updating signatures." );
			})
			.then(function() {
				setTimeout( updateSignatures, config.signatureRefresh );
			});
	}

	return function() {
		return promise;
	};
})();
