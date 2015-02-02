var fs = require( "fs" ),
	Promise = require( "es6-promise" ).Promise,
	config = require( "../lib/config" ),
	Repo = require ( "../lib/repo" );

exports.fetch = {
	setUp: function( done ) {
		this.repo = new Repo( "test-repo" );
		done();
	},

	"repo does not exist": function( test ) {
		test.expect( 4 );

		var providedRef = "my-ref";

		this.repo.exists = function() {
			test.ok( true, "Should check if repo exists" );
			return Promise.resolve( false );
		};

		this.repo._clone = function() {
			test.ok( true, "Should clone new repo" );
			return Promise.resolve();
		};

		this.repo._fetch = function( ref ) {
			test.equal( ref, providedRef, "Should fetch expected ref" );
			return Promise.resolve();
		};

		this.repo.fetch( providedRef ).then(function() {
			test.ok( true, "Fetch should resolve" );
			test.done();
		});
	},

	"repo exists": function( test ) {
		test.expect( 3 );

		var providedRef = "my-ref";

		this.repo.exists = function() {
			test.ok( true, "Should check if repo exists" );
			return Promise.resolve( true );
		};

		this.repo._clone = function() {
			test.ok( false, "Should not clone existing repo" );
		};

		this.repo._fetch = function( ref ) {
			test.equal( ref, providedRef, "Should fetch expected ref" );
			return Promise.resolve();
		};

		this.repo.fetch( providedRef ).then(function() {
			test.ok( true, "Fetch should resolve" );
			test.done();
		});
	},

	"error in exists": function( test ) {
		test.expect( 2 );

		var providedRef = "my-ref",
			providedError = new Error();

		this.repo.exists = function() {
			test.ok( true, "Should check if repo exists" );
			return Promise.reject( providedError );
		};

		this.repo._clone = function() {
			test.ok( false, "Should not clone on error" );
		};

		this.repo._fetch = function() {
			test.ok( false, "Should not fetch on error" );
		};

		this.repo.fetch( providedRef ).catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	},

	"error in clone": function( test ) {
		test.expect( 3 );

		var providedRef = "my-ref",
			providedError = new Error();

		this.repo.exists = function() {
			test.ok( true, "Should check if repo exists" );
			return Promise.resolve( false );
		};

		this.repo._clone = function() {
			test.ok( true, "Should clone new repo" );
			return Promise.reject( providedError );
		};

		this.repo._fetch = function() {
			test.ok( false, "Should not fetch on error" );
		};

		this.repo.fetch( providedRef ).catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	},

	"error in fetch": function( test ) {
		test.expect( 4 );

		var providedRef = "my-ref",
			providedError = new Error();

		this.repo.exists = function() {
			test.ok( true, "Should check if repo exists" );
			return Promise.resolve( false );
		};

		this.repo._clone = function() {
			test.ok( true, "Should clone new repo" );
			return Promise.resolve();
		};

		this.repo._fetch = function( ref ) {
			test.equal( ref, providedRef, "Should fetch expected ref" );
			return Promise.reject( providedError );
		};

		this.repo.fetch( providedRef ).catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	}
};

exports.exists = {
	setUp: function( done ) {
		this._stat = fs.stat;

		this.repo = new Repo( "test-repo" );
		done();
	},

	"repo does not exist": function( test ) {
		test.expect( 2 );

		var expectedPath = config.repoDir + "/test-repo";

		fs.stat = function( path, callback ) {
			test.equal( path, expectedPath, "Path should be passed to fs.stat()" );

			var error = new Error();
			error.code = "ENOENT";
			callback( error );
		};

		this.repo.exists().then(function( exists ) {
			test.ok( !exists, "Repo should not exist" );
			test.done();
		});
	},

	"repo exists": function( test ) {
		test.expect( 2 );

		var expectedPath = config.repoDir + "/test-repo";

		fs.stat = function( path, callback ) {
			test.equal( path, expectedPath, "Path should be passed to fs.stat()" );

			callback( null, {} );
		};

		this.repo.exists().then(function( exists ) {
			test.ok( exists, "Repo should exist" );
			test.done();
		});
	},

	"stat error": function( test ) {
		test.expect( 2 );

		var expectedPath = config.repoDir + "/test-repo",
			providedError = new Error();

		fs.stat = function( path, callback ) {
			test.equal( path, expectedPath, "Path should be passed to fs.stat()" );

			callback( providedError );
		};

		this.repo.exists().catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	},

	tearDown: function( done ) {
		fs.stat = this._stat;

		done();
	}
};

exports.auditBranch = {
	setUp: function( done ) {
		this.repo = new Repo( "my-test" );
		this.options = {
			branch: "my-branch",
			signatures: {},
			exceptions: {}
		};
		this.result = {};
		done();
	},

	"success": function( test ) {
		test.expect( 5 );

		var providedOptions = this.options,
			providedResult = this.result;

		this.repo.fetchBranch = function( branch ) {
			test.equal( branch, providedOptions.branch, "Should fetch branch" );
			return Promise.resolve();
		};

		this.repo.audit = function( options ) {
			test.equal( options.committish, providedOptions.branch,
				"Should audit with provided branch" );
			test.strictEqual( options.signatures, providedOptions.signatures,
				"Should audit with provided signatures" );
			test.strictEqual( options.exceptions, providedOptions.exceptions,
				"Should audit with provided exceptions" );
			return Promise.resolve( providedResult );
		};

		this.repo.auditBranch( providedOptions ).then(function( result ) {
			test.strictEqual( result, providedResult, "Should resolve to provided result" );
			test.done();
		});
	},

	"error in fetch": function( test ) {
		test.expect( 2 );

		var providedOptions = this.options,
			providedError = new Error();

		this.repo.fetchBranch = function( branch ) {
			test.equal( branch, providedOptions.branch, "Should fetch branch" );
			return Promise.reject( providedError );
		};

		this.repo.audit = function() {
			test.ok( false, "Should not audit on error" );
		};

		this.repo.auditBranch( providedOptions ).catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	},

	"error in audit": function( test ) {
		test.expect( 2 );

		var providedOptions = this.options,
			providedError = new Error();

		this.repo.fetchBranch = function( branch ) {
			test.equal( branch, providedOptions.branch, "Should fetch branch" );
			return Promise.resolve();
		};

		this.repo.audit = function() {
			return Promise.reject( providedError );
		};

		this.repo.auditBranch( providedOptions ).catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	}
};

exports.auditPr = {
	setUp: function( done ) {
		this.repo = new Repo( "my-test" );
		this.options = {
			pr: 37,
			base: "my-base",
			head: "my-head",
			signatures: {},
			exceptions: {}
		};
		this.committish = this.options.base + ".." + this.options.head;
		this.result = {};
		done();
	},

	"success": function( test ) {
		test.expect( 5 );

		var providedOptions = this.options,
			providedCommittish = this.committish;
			providedResult = this.result;

		this.repo.fetchPr = function( pr ) {
			test.equal( pr, providedOptions.pr, "Should fetch PR" );
			return Promise.resolve();
		};

		this.repo.audit = function( options ) {
			test.equal( options.committish, providedCommittish,
				"Should audit with provided committish" );
			test.strictEqual( options.signatures, providedOptions.signatures,
				"Should audit with provided signatures" );
			test.strictEqual( options.exceptions, providedOptions.exceptions,
				"Should audit with provided exceptions" );
			return Promise.resolve( providedResult );
		};

		this.repo.auditPr( providedOptions ).then(function( result ) {
			test.strictEqual( result, providedResult, "Should resolve to provided result" );
			test.done();
		});
	},

	"error in fetch": function( test ) {
		test.expect( 2 );

		var providedOptions = this.options,
			providedError = new Error();

		this.repo.fetchPr = function( pr ) {
			test.equal( pr, providedOptions.pr, "Should fetch PR" );
			return Promise.reject( providedError );
		};

		this.repo.audit = function() {
			test.ok( false, "Should not audit on error" );
		};

		this.repo.auditPr( providedOptions ).catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	},

	"error in audit": function( test ) {
		test.expect( 2 );

		var providedOptions = this.options,
			providedError = new Error();

		this.repo.fetchPr = function( pr ) {
			test.equal( pr, providedOptions.pr, "Should fetch PR" );
			return Promise.resolve();
		};

		this.repo.audit = function() {
			return Promise.reject( providedError );
		};

		this.repo.auditPr( providedOptions ).catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	}
};
