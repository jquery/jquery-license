var sinon = require( "sinon" );
var signatures = require( "../lib/signatures" );
var caaSignatures = require( "./signatures-caa.json" );
var claSignatures = require( "./signatures-cla.json" );

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
					"github@pan.com": "Peter Pan",
					"code@pan.com": "Peter Pan",
					"alice@wonderland.eu": "Alice Wonderland",
					"bobbelcher@gmail.com": "Bob Belcher",
					"scott.gonzalez@gmail.com": "Scott González",
					"arschmitz@gmail.com": "Alexander Schmitz",
					"joern.zaefferer@gmail.com": "Jörn Zaefferer"
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
