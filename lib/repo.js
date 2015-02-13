var requestDebugger,
	exec = require( "child_process" ).exec,
	fs = require( "fs" ),
	Promise = require( "es6-promise" ).Promise,
	github = require( "github-request" ),
	mkdirp = require( "mkdirp" ),
	createDebugger = require( "debug" ),
	config = require( "./config" );

requestDebugger = (function() {
	var requestId = 0;
	return function() {
		return createDebugger( "github:" + ( ++requestId ) );
	};
})();

function Repo( name ) {
	this.name = name;
	this.path = config.repoDir + "/" + name;
	this.remoteUrl = "git://github.com/" + config.owner + "/" + name + ".git";
	this.debug = createDebugger( "repo:" + name );
}

Repo.get = (function() {
	var repos = {};

	return function( name ) {
		if ( !repos.hasOwnProperty( name ) ) {
			repos[ name ] = new Repo( name );
		}

		return repos[ name ];
	};
})();

Repo.prototype.fetchBranch = function( branch ) {
	return this.fetch( "heads/" + branch );
};

Repo.prototype.fetchPr = function( pr ) {
	return this.fetch( "pull/" + pr + "/head" );
};

Repo.prototype.fetch = function( ref ) {
	var repo = this;
	return repo.exists()
		.then(function( exists ) {
			if ( !exists ) {
				return repo._clone();
			}
		})
		.then(function() {
			return repo._fetch( ref );
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

	repo.debug( "fetching repo" );
	return new Promise(function( resolve, reject ) {
		exec( "git fetch -fu origin refs/" + ref + ":" + ref, {
			cwd: repo.path
		}, function( error ) {
			if ( error ) {
				repo.debug( "error fetching repo", error );
				return reject( error );
			}

			repo.debug( "successfully fetched repo" );
			resolve();
		});
	});
};

Repo.prototype.request = function( options, data ) {
	var requestDebug = requestDebugger();
	options.path = "/repos/" + config.owner + "/" + this.name + options.path;

	if ( !options.headers ) {
		options.headers = {};
	}
	options.headers.Authorization = "token " + config.githubToken;

	requestDebug( "request", options, data );
	return new Promise(function( resolve, reject ) {
		github.request( options, data, function( error, data ) {
			if ( error ) {
				requestDebug( "error", error );
				return reject( error );
			}

			requestDebug( "success", data );
			resolve( data );
		});
	});
};

Repo.prototype.auditBranch = function( options ) {
	var repo = this;
	return this.fetchBranch( options.branch ).then(function() {
		return repo.audit({
			committish: options.branch,
			signatures: options.signatures,
			exceptions: options.exceptions
		});
	});
};

Repo.prototype.auditPr = function( options ) {
	var repo = this;
	return this.fetchPr( options.pr ).then(function() {
		return repo.audit({
			committish: options.base + ".." + options.head,
			signatures: options.signatures,
			exceptions: options.exceptions
		});
	});
};

Repo.prototype.audit = function( options ) {
	var exceptions = options.exceptions || [];

	return this.getCommits( options.committish ).then(function( commits ) {
		var neglectedCommits,
			neglectedAuthors = {},
			neglectedAuthorsSorted = [];

		// Filter out authors who have signed a CLA or CAA
		neglectedCommits = commits.filter(function( commit ) {
			return !options.signatures.hasOwnProperty( commit.email );
		});

		// Filter out exceptions (trivial or removed code)
		neglectedCommits = neglectedCommits.filter(function( commit ) {
			return exceptions.indexOf( commit.hash ) === -1;
		});

		// Group neglected commits by author
		neglectedCommits.forEach(function( commit ) {
			if ( !neglectedAuthors.hasOwnProperty( commit.email ) ) {
				neglectedAuthors[ commit.email ] = {
					name: commit.name,
					commits: []
				};
			}

			neglectedAuthors[ commit.email ].commits.push( commit );
		});

		// Sort neglected authors by commit count
		neglectedAuthorsSorted = Object.keys( neglectedAuthors ).map(function( authorEmail ) {
			return {
				email: authorEmail,
				name: neglectedAuthors[ authorEmail ].name,
				commits: neglectedAuthors[ authorEmail ].commits.map(function( commit ) {
					return commit.hash;
				})
			};
		}).sort(function( a, b ) {
			return b.commits.length - a.commits.length;
		});

		return {
			commits: commits,
			neglectedCommits: neglectedCommits,
			neglectedAuthors: neglectedAuthorsSorted
		};
	});
};

Repo.prototype.getCommits = function( committish ) {
	var repo = this;
	return new Promise(function( resolve, reject ) {
		exec( "git log --format='%H %aE %aN' " + committish, {
			cwd: repo.path,
			maxBuffer: 1024 * 1024
		}, function( error, log ) {
			if ( error ) {
				return reject( error );
			}

			var commits = log.trim().split( "\n" ).map(function( commit ) {
				var matches = /^(\S+)\s(\S+)\s(.+)$/.exec( commit );

				return {
					hash: matches[ 1 ],
					email: matches[ 2 ],
					name: matches[ 3 ]
				};
			});

			resolve( commits );
		});
	});
};

Repo.prototype.getPrCommitRange = function( pr ) {
	return this.request({
		path: "/pulls/" + pr
	}).then(function( data ) {
		return {
			base: data.base.sha,
			head: data.head.sha
		};
	});
};

Repo.prototype.setStatus = function( options ) {
	var data = {
		state: options.state,
		context: "jQuery Foundation CLA"
	};

	if ( options.url ) {
		data.target_url = options.url;
	}

	if ( options.description ) {
		data.description = options.description;
	}

	this.debug( "setting commit status", options );
	return this.request({
		path: "/statuses/" + options.sha,
		method: "POST"
	}, data );
};

Repo.prototype.getLabels = function( options ) {
	var path = "/labels";
	if ( options ) {
		path = "/issues/" + (options.issue || options.pr) + "/labels";
	}
	path += "?per_page=100";
	return this.request({
		path: path
	});
};

Repo.prototype.createLabel = function( options ) {
	return this.request({
		path: "/labels",
		method: "POST"
	}, {
		name: options.name,
		color: options.color || "ffffff"
	});
};

Repo.prototype.addLabel = function( options ) {
	return this.request({
		path: "/issues/" + (options.issue || options.pr) + "/labels",
		method: "POST"
	}, [ options.label ] );
};

Repo.prototype.removeLabel = function( options ) {
	return this.request({
		path: "/issues/" + (options.issue || options.pr) + "/labels/" + encodeURI( options.label ),
		method: "DELETE"
	});
};

module.exports = Repo;
