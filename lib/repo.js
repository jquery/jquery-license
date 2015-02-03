var exec = require( "child_process" ).exec,
	fs = require( "fs" ),
	Promise = require( "es6-promise" ).Promise,
	github = require( "github-request" ),
	mkdirp = require( "mkdirp" ),
	config = require( "./config" );

function Repo( name ) {
	this.name = name;
	this.path = config.repoDir + "/" + name;
	this.remoteUrl = "git://github.com/" + config.owner + "/" + name + ".git";
}

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
				return resolve( true );
			}

			// Error other than repo not existing
			if ( error.code !== "ENOENT" ) {
				return reject( error );
			}

			resolve( false );
		});
	});
};

Repo.prototype._clone = function() {
	var repo = this;
	return new Promise(function( resolve, reject ) {

		// Ensure the path exists before trying to clone
		mkdirp( repo.path, "0755", function( error ) {
			if ( error ) {
				return reject( error );
			}

			exec( "git clone " + repo.remoteUrl + " " + repo.path, function( error ) {
				if ( error ) {
					return reject( error );
				}

				resolve();
			});
		});
	});
};

Repo.prototype._fetch = function( ref ) {
	var repo = this;
	return new Promise(function( resolve, reject ) {
		exec( "git fetch -fu origin refs/" + ref + ":" + ref, {
			cwd: repo.path
		}, function( error ) {
			if ( error ) {
				return reject( error );
			}

			resolve();
		});
	});
};

Repo.prototype.request = function( options, data ) {
	options.path = "/repos/" + config.owner + "/" + this.name + options.path;

	if ( !options.headers ) {
		options.headers = {};
	}
	options.headers.Authorization = "token " + config.githubToken;

	return new Promise(function( resolve, reject ) {
		github.request( options, data, function( error, data ) {
			if ( error ) {
				return reject( error );
			}

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
				neglectedAuthors[ commit.email ] = [];
			}

			neglectedAuthors[ commit.email ].push( commit );
		});

		// Sort neglected authors by commit count
		neglectedAuthorsSorted = Object.keys( neglectedAuthors ).map(function( authorEmail ) {
			return {
				email: authorEmail,
				commits: neglectedAuthors[ authorEmail ].map(function( commit ) {
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

	return this.request({
		path: "/statuses/" + options.sha,
		method: "POST"
	}, data );
};

Repo.prototype.getLabels = function() {
	return this.request({
		path: "/labels"
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
