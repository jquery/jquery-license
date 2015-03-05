var exec = require( "child_process" ).exec,
	Promise = require( "es6-promise" ).Promise;

module.exports = function( Repo ) {

Repo.prototype.auditBranch = function( options ) {
	var repo = this;
	return this.fetch( this.remoteUrl, options.branch ).then(function() {
		return repo.audit({
			committish: options.branch,
			signatures: options.signatures,
			exceptions: options.exceptions
		});
	});
};

Repo.prototype.auditPr = function( options ) {
	var repo = this;
	return Promise.all([
		this.fetch( this.remoteUrl, options.baseBranch ),
		this.fetch( options.headRemote, options.headBranch )
	])
		.then(function() {
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
			if ( !options.signatures.hasOwnProperty( commit.email ) ) {
				return true;
			}

			return commit.name !== options.signatures[ commit.email ];
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

};
