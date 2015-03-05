var Promise = require( "es6-promise" ).Promise,
	fs = require( "fs" ),
	exec = require( "child_process" ).exec,
	mkdirp = require( "mkdirp" ),
	util = require( "../util" );

module.exports = function( Repo ) {

Repo.prototype.fetchBranch = function( branch ) {
	return this.fetch( "heads/" + branch );
};

Repo.prototype.fetchPr = function( pr ) {
	return this.fetch( "pull/" + pr + "/head" );
};

Repo.prototype.fetch = function( ref ) {
	var repo = this;

	// Prior to the first fetch, we don't know if the repo has been cloned.
	// Running simultaneous fetches is fine, even for the same branch. However,
	// we cannot do anything until the repo has been fully cloned or the fetch
	// will fail since the repo doesn't fully exist.
	if ( !repo.hasCloned ) {
		repo.hasCloned = repo.clone();
	}

	return repo.hasCloned
		.then(function() {
			return util.retry(function() {
				return repo._fetch( ref );
			});
		});
};

Repo.prototype.clone = function() {
	var repo = this;

	return repo.exists()
		.then(function( exists ) {
			if ( !exists ) {
				return repo._clone();
			}
		});
};

Repo.prototype.exists = function() {
	var repo = this;
	return new Promise(function( resolve, reject ) {
		fs.stat( repo.path, function( error ) {

			// Repo already exists
			if ( !error ) {
				repo.debug( "local repo already exists" );
				return resolve( true );
			}

			// Error other than repo not existing
			if ( error.code !== "ENOENT" ) {
				repo.debug( "error checking if a local repo exists", error );
				return reject( error );
			}

			repo.debug( "local repo does not yet exist" );
			resolve( false );
		});
	});
};

Repo.prototype._clone = function() {
	var repo = this;

	repo.debug( "cloning repo" );
	return new Promise(function( resolve, reject ) {

		// Ensure the path exists before trying to clone
		mkdirp( repo.path, "0755", function( error ) {
			if ( error ) {
				repo.debug( "error creating path", error );
				return reject( error );
			}

			exec( "git clone " + repo.remoteUrl + " " + repo.path, function( error ) {
				if ( error ) {
					repo.debug( "error cloning " + repo.remoteUrl, error );
					return reject( error );
				}

				repo.debug( "successfully cloned repo" );
				resolve();
			});
		});
	});
};

Repo.prototype._fetch = function( ref ) {
	var repo = this;

	repo.debug( "fetching " + ref );
	return new Promise(function( resolve, reject ) {
		exec( "git fetch -fu origin refs/" + ref + ":" + ref, {
			cwd: repo.path
		}, function( error ) {
			if ( error ) {
				repo.debug( "error fetching " + ref, error );
				return reject( error );
			}

			repo.debug( "successfully fetched " + ref );
			resolve();
		});
	});
};

};
