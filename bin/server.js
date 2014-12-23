#!/usr/bin/env node

var signatures,
	http = require( "http" ),
	Notifier = require( "git-notifier" ).Notifier,
	auditPr = require( "../lib/pr" ).audit,
	getSignatures = require( "../lib/signatures" ).hashed,
	config = require( "../lib/config" );

console.log( "Loading CLA & CAA signatures..." );
getSignatures(function( error, _signatures ) {
	if ( error ) {
		console.error( "Error getting CLA & CAA signatures." );
		throw error;
	}

	var server = http.createServer(),
		notifier = new Notifier();

	// Repeatedly get new signatures
	signatures = _signatures;
	setTimeout( updateSignatures, config.signatureRefresh );

	// Create the notifier
	server.on( "request", notifier.handler );
	server.listen( config.port );
	notifier.on( config.owner + "/*/pull_request", prHook );

	console.log( "Listening on port " + config.port + "." );
});

function prHook( event ) {
	if ( event.payload.action !== "opened" && event.payload.action !== "synchronize" ) {
		return;
	}

	auditPr({
		repo: event.repo,
		pr: event.pr,
		base: event.base,
		head: event.head,
		signatures: signatures
	}, function() {

		// Nothing to do here, even if there's an error
	});
}

// Fetch new CLA signatures every minute
function updateSignatures() {
	getSignatures(function( error, _signatures ) {
		if ( error ) {

			console.error( "Error updating signatures." );
			// Ignore an error at this point, since we already have older signatures
			return;
		}

		signatures = _signatures;
	});

	setTimeout( updateSignatures, config.signatureRefresh );
}
