var Promise = require( "es6-promise" ).Promise,
	util = require ( "../lib/util" );

exports.retry = {
	setUp: function( done ) {
		this.delay = util.delay;
		done();
	},

	tearDown: function( done ) {
		util.delay = this.delay;
		done();
	},

	"success on first attempt": function( test ) {
		test.expect( 2 );

		var promise,
			providedValue = {};

		promise = util.retry(function() {
			test.ok( true, "Method should be invoked once" );
			return Promise.resolve( providedValue );
		});

		promise.then(function( value ) {
			test.strictEqual( value, providedValue, "Should pass along value" );
			test.done();
		});
	},

	"success on second attempt": function( test ) {
		test.expect( 4 );

		var promise, method,
			realDelay = this.delay,
			providedValue = {};

		function method1() {
			test.ok( true, "Method should be invoked once" );

			method = method2;
			util.delay = function( method, duration ) {
				test.equal( duration, 2000, "Should delay for 2 seconds" );
				return realDelay( method, 1 );
			};

			return Promise.reject( new Error() );
		}

		function method2() {
			test.ok( true, "Method should be invoked twice" );

			util.delay = function() {
				test.ok( false, "Should not delay after resolving" );
			};

			return Promise.resolve( providedValue );
		}

		method = method1;
		promise = util.retry(function() {
			return method();
		});

		promise.then(function( value ) {
			test.strictEqual( value, providedValue, "Should pass along value" );
			test.done();
		});
	},

	"error on third attempt": function( test ) {
		test.expect( 6 );

		var promise, method,
			realDelay = this.delay,
			providedError = new Error();

		function method1() {
			test.ok( true, "Method should be invoked once" );

			method = method2;
			util.delay = function( method, duration ) {
				test.equal( duration, 2000, "Should delay for 2 seconds" );
				return realDelay( method, 1 );
			};

			return Promise.reject( new Error() );
		}

		function method2() {
			test.ok( true, "Method should be invoked twice" );

			method = method3;
			util.delay = function( method, duration ) {
				test.equal( duration, 4000, "Should delay for 4 seconds" );
				return realDelay( method, 1 );
			};

			return Promise.reject( new Error() );
		}

		function method3() {
			test.ok( true, "Method should be invoked thrice" );

			util.delay = function() {
				test.ok( false, "Should not delay after three failures" );
			};

			return Promise.reject( providedError );
		}

		method = method1;
		promise = util.retry(function() {
			return method();
		});

		promise.catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	}
};
