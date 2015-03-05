var fs = require( "fs" ),
	Promise = require( "es6-promise" ).Promise,
	config = require( "../lib/config" ),
	Repo = require ( "../lib/repo" ),
	util = require( "../lib/util" );

exports.get = {
	"returns singleton": function( test ) {
		test.expect( 3 );

		var instance1 = Repo.get( "test-repo" ),
			instance2 = Repo.get( "test-repo" ),
			instance3 = Repo.get( "test-repo-2" );

		test.equal( instance1.name, "test-repo", "Instance #1 has correct repo name" );
		test.equal( instance3.name, "test-repo-2", "Instance #3 has correct repo name" );
		test.strictEqual( instance1, instance2, "Returns same instance per repo" );
		test.done();
	}
};

exports.fetch = {
	setUp: function( done ) {
		this.repo = new Repo( "test-repo" );

		this.retry = util.retry;
		util.retry = function( method ) {
			return method();
		};

		done();
	},

	tearDown: function( done ) {
		util.retry = this.retry;

		done();
	},

	"clone and fetch succeed": function( test ) {
		test.expect( 3 );

		var providedRef = "my-ref";

		this.repo.clone = function() {
			test.ok( true, "Should clone repo" );
			return Promise.resolve();
		};

		this.repo._fetch = function( ref ) {
			test.equal( ref, providedRef, "Should fetch expected ref" );
			return Promise.resolve();
		};

		this.repo.fetch( providedRef ).then(function() {
			test.ok( "Fetch should resolve" );
			test.done();
		});
	},

	"clone errors": function( test ) {
		test.expect( 2 );

		var providedRef = "my-ref",
			providedError = new Error();

		this.repo.clone = function() {
			test.ok( true, "Should clone" );
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

	"fetch errors": function( test ) {
		test.expect( 3 );

		var providedRef = "my-ref",
			providedError = new Error();

		this.repo.clone = function() {
			test.ok( true, "Should clone" );
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
	},

	"fetch succeeds after previous clone succeeds": function( test ) {
		test.expect( 2 );

		var providedRef = "my-ref";

		this.repo.hasCloned = Promise.resolve();

		this.repo.clone = function() {
			test.ok( false, "Should not repeat clone" );
		};

		this.repo._fetch = function( ref ) {
			test.equal( ref, providedRef, "Should fetch expected ref" );
			return Promise.resolve();
		};

		this.repo.fetch( providedRef ).then(function() {
			test.ok( "Fetch should resolve" );
			test.done();
		});
	},

	"fetch errors after previous clone succeeds": function( test ) {
		test.expect( 2 );

		var providedRef = "my-ref",
			providedError = new Error();

		this.repo.hasCloned = Promise.resolve();

		this.repo.clone = function() {
			test.ok( false, "Should not repeat clone" );
		};

		this.repo._fetch = function( ref ) {
			test.equal( ref, providedRef, "Should fetch expected ref" );
			return Promise.reject( providedError );
		};

		this.repo.fetch( providedRef ).catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	},

	"fetch after previous clone failed": function( test ) {
		test.expect( 1 );

		var providedRef = "my-ref",
			providedError = new Error();

		this.repo.hasCloned = Promise.reject( providedError );

		this.repo.clone = function() {
			test.ok( false, "Should not repeat clone" );
		};

		this.repo._fetch = function() {
			test.ok( false, "Should not fetch after clone error" );
		};

		this.repo.fetch( providedRef ).catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	}
};

exports.clone = {
	setUp: function( done ) {
		this.repo = new Repo( "test-repo" );
		done();
	},

	"repo does not exist": function( test ) {
		test.expect( 3 );

		this.repo.exists = function() {
			test.ok( true, "Should check if repo exists" );
			return Promise.resolve( false );
		};

		this.repo._clone = function() {
			test.ok( true, "Should clone new repo" );
			return Promise.resolve();
		};

		this.repo.clone().then(function() {
			test.ok( true, "Clone should resolve" );
			test.done();
		});
	},

	"repo exists": function( test ) {
		test.expect( 2 );

		this.repo.exists = function() {
			test.ok( true, "Should check if repo exists" );
			return Promise.resolve( true );
		};

		this.repo._clone = function() {
			test.ok( false, "Should not clone existing repo" );
		};

		this.repo.clone().then(function() {
			test.ok( true, "Clone should resolve" );
			test.done();
		});
	},

	"error in exists": function( test ) {
		test.expect( 2 );

		var providedError = new Error();

		this.repo.exists = function() {
			test.ok( true, "Should check if repo exists" );
			return Promise.reject( providedError );
		};

		this.repo._clone = function() {
			test.ok( false, "Should not clone on error" );
		};

		this.repo.clone().catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	},

	"error in _clone": function( test ) {
		test.expect( 3 );

		var providedError = new Error();

		this.repo.exists = function() {
			test.ok( true, "Should check if repo exists" );
			return Promise.resolve( false );
		};

		this.repo._clone = function() {
			test.ok( true, "Should clone new repo" );
			return Promise.reject( providedError );
		};

		this.repo.clone().catch(function( error ) {
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
			baseBranch: "my-base-branch",
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
		test.expect( 6 );

		var providedOptions = this.options,
			providedCommittish = this.committish;
			providedResult = this.result;

		this.repo.fetchBranch = function( branch ) {
			test.equal( branch, providedOptions.baseBranch, "Should fetch base branch" );
			return Promise.resolve();
		};

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

	"error in fetchBranch": function( test ) {
		test.expect( 3 );

		var providedOptions = this.options,
			providedError = new Error();

		this.repo.fetchBranch = function( branch ) {
			test.equal( branch, providedOptions.baseBranch, "Should fetch base branch" );
			return Promise.reject( providedError );
		};

		this.repo.fetchPr = function( pr ) {
			test.equal( pr, providedOptions.pr, "Should fetch PR" );
			return Promise.resolve();
		};

		this.repo.audit = function() {
			test.ok( false, "Should not audit on error" );
		};

		this.repo.auditPr( providedOptions ).catch(function( error ) {
			test.strictEqual( error, providedError, "Should pass along error" );
			test.done();
		});
	},

	"error in fetchPr": function( test ) {
		test.expect( 3 );

		var providedOptions = this.options,
			providedError = new Error();

		this.repo.fetchBranch = function( branch ) {
			test.equal( branch, providedOptions.baseBranch, "Should fetch base branch" );
			return Promise.resolve();
		};

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
		test.expect( 3 );

		var providedOptions = this.options,
			providedError = new Error();

		this.repo.fetchBranch = function( branch ) {
			test.equal( branch, providedOptions.baseBranch, "Should fetch base branch" );
			return Promise.resolve();
		};

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
