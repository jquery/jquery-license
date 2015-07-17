var sinon = require( "sinon" ),
	http = require( "http" ),
	gitNotifier = require( "git-notifier" ),
	Repo = require( "../lib/repo" ),
	pr = require( "../lib/pr" ),
	signatures = require( "../lib/signatures" ),
	config = require( "../lib/config" );

exports.get = {
	setUp: function( done ) {
		this.setTimeout = setTimeout;
		this.clock = sinon.useFakeTimers();
		this.sandbox = sinon.sandbox.create();
		this.sandbox.stub( http, "createServer" ).returns( {
			on: function() {},
			listen: function() {}
		} );
		this.sandbox.stub( gitNotifier, "Notifier" ).returns( {
			on: function( event, callback ) {
				if ( event === "error" ) {
					return;
				}
				this.notifierCallback = callback;
			}.bind( this )
		} );
		this.sandbox.stub( Repo, "get" ).returns( {
			setStatus: function() {}
		} );
		this.sandbox.stub( pr, "audit" ).returns( Promise.resolve( {
			state: "failure"
		} ) );
		this.sandbox.stub( signatures, "hashed" ).returns( Promise.resolve( {
			"name@email.com": "Firstname Lastname"
		} ) );
		config.owner = "testuser";
		config.port = 8888;
		config.signatureRefresh = 0;
		done();
	},
	tearDown: function( done ) {
		this.clock.restore();
		this.sandbox.restore();
		done();
	},
	"basics": function( test ) {
		test.expect( 4 );

		require( "../bin/server.js" );

		var payload = {
			action: "synchronize",
			pull_request: {
				base: {},
				head: {}
			}
		};
		this.notifierCallback( {
			repo: "testrepo",
			pr: "testpr",
			payload: payload
		} );
		this.notifierCallback( {
			repo: "testrepo2",
			pr: "testpr2",
			payload: payload
		} );
		test.equal( signatures.hashed.callCount, 1 );

		// Promise.resolve is async, wait for signatures to resolve
		this.setTimeout( function() {
			test.equal( pr.audit.callCount, 2 );

			signatures.hashed.returns( Promise.resolve( {
				"name@email.com": "Firstname Lastname",
				"new@email.com": "New Name"
			} ) );

			// Trigger signature refresh timeout
			this.clock.tick( 1 );

			// Same waiting as above
			this.setTimeout( function() {
				test.equal( signatures.hashed.callCount, 2 );
				test.equal( pr.audit.callCount, 4 );

				test.done();
			} );
		}.bind( this ) );
	}
};
