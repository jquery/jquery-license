var exec = require( "child_process" ).exec,
	fs = require( "fs" ),
	github = require( "github-request" ),
	mkdirp = require( "mkdirp" ),
	config = require( "./config" );

function Repo( name ) {
	this.name = name;
	this.path = config.repoDir + "/" + name;
	this.remoteUrl = "git://github.com/" + config.owner + "/" + name + ".git";
}

Repo.prototype.fetchBranch = function( branch, callback ) {
	this.fetch( "heads/" + branch, callback );
};

Repo.prototype.fetchPr = function( pr, callback ) {
	this.fetch( "pull/" + pr + "/head", callback );
};

Repo.prototype.fetch = function( ref, callback ) {
	var repo = this;

	fs.stat( this.path, function( error ) {

		// Repo already exists
		if ( !error ) {
			return repo._fetch( ref, callback );
		}

		// Error other than repo not existing
		if ( error.code !== "ENOENT" ) {
			return callback( error );
		}

		// Clone the repo, then fetch
		repo._clone(function( error ) {
			if ( error ) {
				return callback( error );
			}

			repo._fetch( ref, callback );
		});
	});
};

Repo.prototype._clone = function( callback ) {
	var repo = this;

	// Ensure the path exists before trying to clone
	mkdirp( this.path, "0755", function( error ) {
		if ( error ) {
			return callback( error );
		}

		exec( "git clone " + repo.remoteUrl + " " + repo.path, callback );
	});
};

Repo.prototype._fetch = function( ref, callback ) {
	exec( "git fetch -fu origin refs/" + ref + ":" + ref, {
		cwd: this.path
	}, function( error ) {

		// Wrap the callback just to prevent leaking stdout and stderr parameters
		callback( error );
	});
};

Repo.prototype.auditBranch = function( options, callback ) {
	var repo = this;
	this.fetchBranch( options.branch, function( error ) {
		if ( error ) {
			return callback( error );
		}

		repo.audit({
			repo: repo.name,
			committish: options.branch,
			signatures: options.signatures,
			exceptions: options.exceptions
		}, callback );
	});
};

Repo.prototype.auditPr = function( options, callback ) {
	var repo = this;
	this.fetchPr( options.pr, function( error ) {
		if ( error ) {
			return callback( error );
		}

		function audit( range ) {
			repo.audit({
				repo: repo.name,
				committish: range,
				signatures: options.signatures,
				exceptions: options.exceptions
			}, callback );
		}

		if ( options.range ) {
			return audit( options.range );
		}

		repo.getPrCommitRange( options.pr, function( error, range ) {
			if ( error ) {
				return callback( error );
			}

			audit( range );
		});
	});
};

Repo.prototype.audit = function( options, callback ) {
	var exceptions = options.exceptions || [];

	this.getCommits( options.committish, function( error, commits ) {
		if ( error ) {
			return callback( error );
		}

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

		callback( null, {
			commits: commits,
			neglectedCommits: neglectedCommits,
			neglectedAuthors: neglectedAuthorsSorted
		});
	});
};

Repo.prototype.getCommits = function( committish, callback ) {
	var repo = this;

	exec( "git log --format='%H %aE %aN' " + committish, {
		cwd: this.path,
		maxBuffer: 1024 * 1024
	}, function( error, log ) {
		if ( error ) {
			return callback( error );
		}

		var commits = log.trim().split( "\n" ).map(function( commit ) {
			var matches = /^(\S+)\s(\S+)\s(.+)$/.exec( commit );

			return {
				hash: matches[ 1 ],
				email: matches[ 2 ],
				name: matches[ 3 ]
			};
		});

		callback( null, commits );
	});
};

Repo.prototype.getPrCommitRange = function( pr, callback ) {
	github.request({
		path: "/repos/" + config.owner + "/" + this.name + "/pulls/" + pr
	}, function( error, data ) {
		if ( error ) {
			return callback( error );
		}

		callback( null, data.base.sha + ".." + data.head.sha );
	});
};

Repo.prototype.setStatus = function( options, callback ) {
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

	github.request({
		path: "/repos/" + config.owner + "/" + this.name + "/statuses/" + options.sha,
		method: "POST",
		headers: {
			Authorization: "token " + config.githubToken
		}
	}, data, callback );
};

module.exports = Repo;
