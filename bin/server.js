#!/usr/bin/env node

var getSignatures,
	http = require( "http" ),
	Notifier = require( "git-notifier" ).Notifier,
	logger = require( "simple-log" ).init( "jquery-license" ),
	debug = require( "debug" )( "server" ),
	Repo = require( "../lib/repo" ),
	auditPr = require( "../lib/pr" ).audit,
	getHashedSignatures = require( "../lib/signatures" ).hashed,
	config = require( "../lib/config" ),
	async = require( "async" );

var server = http.createServer(),
	notifier = new Notifier(),
	failedEvents = [];

// Create the notifier
server.on( "request", notifier.handler );
server.listen( config.port );
[ ].concat( config.owner ).forEach( function( owner ) {
	notifier.on( owner + "/*/pull_request", prHook );
} );
notifier.on( "error", function( error ) {
	debug( "invalid hook request", error );
} );

debug( "listening on port " + config.port );

function prHook( event, done ) {
	if ( !done ) {
		done = function() {};
	}
	if ( event.payload.action !== "opened" && event.payload.action !== "synchronize" ) {
		return;
	}

	debug( "processing hook", event.owner, event.repo, event.pr );
	getSignatures().then(
		function( signatures ) {
			auditPr( {
				action: event.payload.action,
				owner: event.owner,
				repo: event.repo,
				pr: event.pr,
				baseRemote: event.payload.pull_request.base.git_url,
				baseBranch: event.payload.pull_request.base.ref,
				base: event.base,
				headRemote: event.payload.pull_request.head.git_url,
				headBranch: event.payload.pull_request.head.ref,
				head: event.head,
				signatures: signatures
			} )
				.then( function( status ) {
					if ( status.auditError ) {
						throw status.auditError;
					}
					if ( status.state === "failure" ) {
						failedEvents.push( event );
					}
					done();
				} )
				.catch( function( error ) {
					failedEvents.push( event );
					logger.error( "Error auditing hook", {
						owner: event.owner,
						repo: event.repo,
						pr: event.pr,
						head: event.head,
						error: error.stack
					} );
					done();
				} );
		},

		// If we can't get the signatures, set the status to error
		function() {
			var repo = Repo.get( event.owner, event.repo );
			repo.setStatus( {
				sha: event.head,
				state: "error",
				description: "There was an error checking the CLA status"
			} )
				.then( function() {
					failedEvents.push( event );
					done();
				} )
				.catch( function( error ) {
					logger.error( "Error setting status", {
						owner: event.owner,
						repo: event.repo,
						pr: event.pr,
						head: event.head,
						error: error.stack
					} );
					failedEvents.push( event );
					done();
				} );
		}
	);
}

// Fetch new CLA signatures periodically
getSignatures = ( function() {
	var signatures;
	var promise = getHashedSignatures();
	promise
		.then( function( initialSignatures ) {
			signatures = initialSignatures;
		} );

	function updateSignatures() {
		var updatedPromise = getHashedSignatures();

		debug( "updating signatures" );
		updatedPromise
			.then( function( newSignatures ) {
				debug( "successfully updated signatures" );
				promise = updatedPromise;
				if ( Object.keys( signatures ).length !== Object.keys( newSignatures ).length ) {
					signatures = newSignatures;
					async.eachSeries( failedEvents.splice( 0 ), function( event, done ) {

						// Overide action to avoid posting comments twice
						event.payload.action = "synchronize";
						prHook( event, done );
					} );
				}
			} )
			.catch( function( error ) {
				logger.error( "Error getting signatures", error.stack );
				debug( "error updating signatures", error );
			} )
			.then( function() {
				setTimeout( updateSignatures, config.signatureRefresh );
			} );
	}

	setTimeout( updateSignatures, config.signatureRefresh );

	return function() {
		return promise;
	};
} )();
