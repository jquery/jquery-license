var sinon = require( "sinon" );
var signatures = require( "../lib/signatures" );
var caaSignatures = require( "./signatures-caa.json" );
var claSignatures = require( "./signatures-cla.json" );
var Promise = require( "es6-promise" ).Promise;

exports.hashed = {
	setUp: function( done ) {
		this.sandbox = sinon.sandbox.create();
		this.sandbox.stub( signatures, "raw" );
		signatures.raw.onCall( 0 ).returns( Promise.resolve( claSignatures ) );
		signatures.raw.onCall( 1 ).returns( Promise.resolve( caaSignatures ) );
		done();
	},
	tearDown: function( done ) {
		this.sandbox.restore();
		done();
	},
	basics: function( test ) {
		test.expect( 1 );

		signatures.hashed()
			.then( function( result ) {
				test.deepEqual( result, {
					"github@pan.com": { names: [ "Peter Pan" ], errors: [] },
					"code@pan.com": { names: [ "Peter Pan" ], errors: [] },
					"alice@wonderland.eu": {
						names: [
							"Alice Wonderland",
							"Alice Mallory Wonderland",
							"Alice M. Wonderland"
						],
						errors: []
					},
					"bobbelcher@gmail.com": { names: [ "Bob Belcher" ], errors: [] },
					"noagree@gmail.com": {
						names: [ "No Agree" ],
						errors: [ "noagree@gmail.com did not properly confirm agreement." ]
					},
					"invalidemail.com": {
						names: [ "Invalid Email" ],
						errors: [ "invalidemail.com is not a valid email address." ]
					},
					"invalidhost@noreply.github.com": {
						names: [ "Invalid Host" ],
						errors: [ "invalidhost@noreply.github.com is a private GitHub email" +
							" address." ]
					},
					"invalidname@email.com": {
						names: [ "InvalidName" ],
						errors: [ "Suspicious name: InvalidName" ]
					},
					"doublesignature@email.com": { names: [ "Double Signature" ], errors: [] },
					"reversedouble@email.com": { names: [ "Reverse Double" ], errors: [] },
					"scott.gonzalez@gmail.com": { names: [ "Scott González" ], errors: [] },
					"arschmitz@gmail.com": { names: [ "Alexander Schmitz" ], errors: [] },
					"joern.zaefferer@gmail.com": { names: [ "Jörn Zaefferer" ], errors: [] }
				} );
				test.done();
			} )
			.catch( function( error ) {
				console.log( error, error.stack );
				test.ok( false, error );
				test.done();
			} );
	}
};
