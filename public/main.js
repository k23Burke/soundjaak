'use strict';
var app = angular.module('FullstackGeneratedApp', ['ui.router', 'ui.bootstrap', 'fsaPreBuilt', 'ngStorage']);

app.config(function ($urlRouterProvider, $locationProvider) {
    // This turns off hashbang urls (/#about) and changes it to something normal (/about)
    $locationProvider.html5Mode(true);
    // If we go to a URL that ui-router doesn't have registered, go to the "/" url.
    $urlRouterProvider.otherwise('/');
});

// This app.run is for controlling access to specific states.
app.run(function ($rootScope, AuthService, $state) {

    // The given state requires an authenticated user.
    var destinationStateRequiresAuth = function destinationStateRequiresAuth(state) {
        return state.data && state.data.authenticate;
    };

    // $stateChangeStart is an event fired
    // whenever the process of changing a state begins.
    $rootScope.$on('$stateChangeStart', function (event, toState, toParams) {

        if (!destinationStateRequiresAuth(toState)) {
            // The destination state does not require authentication
            // Short circuit with return.
            return;
        }

        if (AuthService.isAuthenticated()) {
            // The user is authenticated.
            // Short circuit with return.
            return;
        }

        // Cancel navigating to new state.
        event.preventDefault();

        AuthService.getLoggedInUser().then(function (user) {
            // If a user is retrieved, then renavigate to the destination
            // (the second time, AuthService.isAuthenticated() will work)
            // otherwise, if no user is logged in, go to "login" state.
            if (user) {
                $state.go(toState.name, toParams);
            } else {
                $state.go('login');
            }
        });
    });
});
(function () {

    'use strict';

    // Hope you didn't forget Angular! Duh-doy.
    if (!window.angular) throw new Error('I can\'t find Angular!');

    var app = angular.module('fsaPreBuilt', []);

    app.factory('Socket', function ($location) {
        if (!window.io) throw new Error('socket.io not found!');
        return window.io(window.location.origin);
    });

    // AUTH_EVENTS is used throughout our app to
    // broadcast and listen from and to the $rootScope
    // for important events about authentication flow.
    app.constant('AUTH_EVENTS', {
        loginSuccess: 'auth-login-success',
        loginFailed: 'auth-login-failed',
        logoutSuccess: 'auth-logout-success',
        sessionTimeout: 'auth-session-timeout',
        notAuthenticated: 'auth-not-authenticated',
        notAuthorized: 'auth-not-authorized'
    });

    app.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
        var statusDict = {
            401: AUTH_EVENTS.notAuthenticated,
            403: AUTH_EVENTS.notAuthorized,
            419: AUTH_EVENTS.sessionTimeout,
            440: AUTH_EVENTS.sessionTimeout
        };
        return {
            responseError: function responseError(response) {
                $rootScope.$broadcast(statusDict[response.status], response);
                return $q.reject(response);
            }
        };
    });

    app.config(function ($httpProvider) {
        $httpProvider.interceptors.push(['$injector', function ($injector) {
            return $injector.get('AuthInterceptor');
        }]);
    });

    app.service('AuthService', function ($http, Session, $rootScope, AUTH_EVENTS, $q) {

        // Uses the session factory to see if an
        // authenticated user is currently registered.
        this.isAuthenticated = function () {
            return !!Session.user;
        };

        this.getLoggedInUser = function () {

            // If an authenticated session exists, we
            // return the user attached to that session
            // with a promise. This ensures that we can
            // always interface with this method asynchronously.
            if (this.isAuthenticated()) {
                return $q.when(Session.user);
            }

            // Make request GET /session.
            // If it returns a user, call onSuccessfulLogin with the response.
            // If it returns a 401 response, we catch it and instead resolve to null.
            return $http.get('/session').then(onSuccessfulLogin)['catch'](function () {
                return null;
            });
        };

        this.login = function (credentials) {
            return $http.post('/login', credentials).then(onSuccessfulLogin)['catch'](function (response) {
                return $q.reject({ message: 'Invalid login credentials.' });
            });
        };

        this.logout = function () {
            return $http.get('/logout').then(function () {
                Session.destroy();
                $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
            });
        };

        function onSuccessfulLogin(response) {
            var data = response.data;
            Session.create(data.id, data.user);
            $rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
            return data.user;
        }

        this.signup = function (credentials) {
            console.log(credentials);
            return $http.post('/signup', credentials).then(onSuccessfulLogin)['catch'](function (response) {
                return $q.reject({ message: 'Invalid signup credentials.' });
            });
        };
    });

    app.service('Session', function ($rootScope, AUTH_EVENTS) {

        var self = this;

        $rootScope.$on(AUTH_EVENTS.notAuthenticated, function () {
            self.destroy();
        });

        $rootScope.$on(AUTH_EVENTS.sessionTimeout, function () {
            self.destroy();
        });

        this.id = null;
        this.user = null;

        this.create = function (sessionId, user) {
            this.id = sessionId;
            this.user = user;
        };

        this.destroy = function () {
            this.id = null;
            this.user = null;
        };
    });
})();
'use strict';
app.config(function ($stateProvider) {
    $stateProvider.state('home', {
        url: '/',
        templateUrl: 'js/home/home.html'
    });

    $stateProvider.state('home.landing', {
        url: '/landing',
        templateUrl: 'js/home/landing.html'
    });
});

app.config(function ($stateProvider) {

    $stateProvider.state('login', {
        url: '/login',
        templateUrl: 'js/login/login.html',
        controller: 'LoginCtrl'
    });
});

app.controller('LoginCtrl', function ($scope, AuthService, $state) {

    $scope.login = {};
    $scope.error = null;

    $scope.sendLogin = function (loginInfo) {

        $scope.error = null;

        AuthService.login(loginInfo).then(function () {
            $state.go('home');
        })['catch'](function () {
            $scope.error = 'Invalid login credentials.';
        });
    };
});
'use strict';
app.config(function ($stateProvider) {
    $stateProvider.state('project', {
        url: '/project/:projectID',
        templateUrl: 'js/project/project.html'
    });
});

app.controller('ProjectController', function ($scope, $stateParams, $compile, RecorderFct, ProjectFct, ToneTrackFct, ToneTimelineFct, AuthService) {

    window.onblur = function () {
        $scope.stop();
    };

    var maxMeasure = 0;

    // number of measures on the timeline
    $scope.numMeasures = _.range(0, 60);

    // length of the timeline
    $scope.measureLength = 1;

    //Initialize recorder on project load
    RecorderFct.recorderInit().then(function (retArr) {
        $scope.recorder = retArr[0];
        $scope.analyserNode = retArr[1];
    })['catch'](function (e) {
        alert('Error getting audio');
        console.log(e);
    });

    $scope.measureLength = 1;
    $scope.nameChanging = false;
    $scope.tracks = [];
    $scope.loading = true;
    $scope.projectId = $stateParams.projectID;
    $scope.position = 0;
    $scope.playing = false;

    ProjectFct.getProjectInfo($scope.projectId).then(function (project) {
        var loaded = 0;
        console.log('PROJECT', project);
        $scope.projectName = project.name;

        if (project.tracks.length) {
            project.tracks.forEach(function (track) {
                var doneLoading = function doneLoading() {
                    loaded++;
                    if (loaded === project.tracks.length) {
                        $scope.loading = false;
                        // Tone.Transport.start();
                    }
                };
                var max = Math.max.apply(null, track.location);
                if (max + 2 > maxMeasure) maxMeasure = max + 2;

                track.empty = false;
                track.recording = false;
                track.silence = false;

                // TODO: this is assuming that a player exists
                track.player = ToneTrackFct.createPlayer(track.url, doneLoading);
                //init effects, connect, and add to scope
                track.effectsRack = ToneTrackFct.effectsInitialize();
                track.player.connect(track.effectsRack[0]);

                if (track.location.length) {
                    ToneTimelineFct.addLoopToTimeline(track.player, track.location);
                    track.onTimeline = true;
                } else {
                    track.onTimeline = false;
                }

                $scope.tracks.push(track);
            });
        } else {
            $scope.maxMeasure = 32;
            for (var i = 0; i < 8; i++) {
                var obj = {};
                obj.empty = true;
                obj.recording = false;
                obj.onTimeline = false;
                obj.previewing = false;
                obj.silence = false;
                obj.effectsRack = ToneTrackFct.effectsInitialize();
                obj.player = null;
                obj.name = 'Track ' + (i + 1);
                obj.location = [];
                $scope.tracks.push(obj);
            }
        }

        //dynamically set measures
        //if less than 16 set 18 as minimum
        $scope.numMeasures = [];
        if (maxMeasure < 32) maxMeasure = 34;
        for (var i = 0; i < maxMeasure; i++) {
            $scope.numMeasures.push(i);
        }
        console.log('MEASURES', $scope.numMeasures);

        ToneTimelineFct.createTransport(project.endMeasure).then(function (metronome) {
            $scope.metronome = metronome;
        });
        ToneTimelineFct.changeBpm(project.bpm);
    });

    $scope.dropInTimeline = function (index) {
        var track = scope.tracks[index];
    };

    $scope.addTrack = function () {};

    $scope.play = function () {
        $scope.playing = true;
        Tone.Transport.position = $scope.position.toString() + ':0:0';
        Tone.Transport.start();
    };
    $scope.pause = function () {
        $scope.playing = false;
        $scope.metronome.stop();
        ToneTimelineFct.stopAll($scope.tracks);
        $scope.position = Tone.Transport.position.split(':')[0];
        console.log('POS', $scope.position);
        var playHead = document.getElementById('playbackHead');
        playHead.style.left = ($scope.position * 200 + 300).toString() + 'px';
        Tone.Transport.pause();
    };
    $scope.stop = function () {
        $scope.playing = false;
        $scope.metronome.stop();
        ToneTimelineFct.stopAll($scope.tracks);
        $scope.position = 0;
        var playHead = document.getElementById('playbackHead');
        playHead.style.left = '300px';
        Tone.Transport.stop();
    };
    $scope.nameChange = function (newName) {
        $scope.nameChanging = false;
    };

    $scope.toggleMetronome = function () {
        if ($scope.metronome.volume.value === 0) {
            $scope.metronome.volume.value = -100;
        } else {
            $scope.metronome.volume.value = 0;
        }
    };

    $scope.sendToAWS = function () {

        RecorderFct.sendToAWS($scope.tracks, $scope.projectId).then(function (response) {
            // wave logic
            console.log('response from sendToAWS', response);
        });
    };

    $scope.isLoggedIn = function () {
        return AuthService.isAuthenticated();
    };
});
app.config(function ($stateProvider) {

    $stateProvider.state('signup', {
        url: '/signup',
        templateUrl: 'js/signup/signup.html',
        controller: 'SignupCtrl'
    });
});

app.controller('SignupCtrl', function ($scope, AuthService, $state) {

    $scope.signup = {};
    $scope.error = null;

    $scope.sendSignup = function (signupInfo) {

        $scope.error = null;
        console.log(signupInfo);
        AuthService.signup(signupInfo).then(function () {
            $state.go('home');
        })['catch'](function () {
            $scope.error = 'Invalid login credentials.';
        });
    };
});
app.config(function ($stateProvider) {

    $stateProvider.state('userProfile', {
        url: '/userprofile/:theID',
        templateUrl: 'js/user/userprofile.html',
        controller: 'UserController',
        // The following data.authenticate is read by an event listener
        // that controls access to this state. Refer to app.js.
        data: {
            authenticate: true
        }
    }).state('userProfile.artistInfo', {
        url: '/info',
        templateUrl: 'js/user/info.html',
        controller: 'UserController'
    }).state('userProfile.project', {
        url: '/projects',
        templateUrl: 'js/user/projects.html',
        controller: 'UserController'
    }).state('userProfile.followers', {
        url: '/followers',
        templateUrl: 'js/user/followers.html',
        controller: 'UserController'
    }).state('userProfile.following', {
        url: '/following',
        templateUrl: 'js/user/following.html',
        controller: 'UserController'
    });
});

app.controller('HomeController', function ($scope, AuthService, ToneTrackFct, ProjectFct, $stateParams, $state) {
    console.log('in Home controller');
    var trackBucket = [];
    $scope.isLoggedIn = function () {
        return AuthService.isAuthenticated();
    };

    $scope.projects = function () {
        console.log('in here');
        ProjectFct.getProjectInfo().then(function (projects) {
            $scope.allProjects = projects;
            // console.log('All Projects are', projects)
        });
    };
    $scope.projects();

    $scope.makeFork = function (project) {};
    var stop = false;

    $scope.sampleTrack = function (track) {

        if (stop === true) {
            $scope.player.stop();
        }

        ToneTrackFct.createPlayer(track.url, function (player) {
            $scope.player = player;
            if (stop === false) {
                stop = true;
                $scope.player.start();
            } else {
                stop = false;
            }
        });
    };

    $scope.getUserProfile = function (user) {
        console.log('clicked', user);
        $state.go('userProfile', { theID: user._id });
    };
});

app.controller('NewProjectController', function ($scope, AuthService, ProjectFct, $state) {
    $scope.user;

    AuthService.getLoggedInUser().then(function (user) {
        $scope.user = user;
        console.log('user is', $scope.user.username);
    });

    $scope.newProjectBut = function () {
        ProjectFct.newProject($scope.user).then(function (projectId) {
            console.log('Success is', projectId);
            $state.go('project', { projectID: projectId });
        });
    };
});
app.controller('TimelineController', function ($scope, $stateParams, $localStorage, RecorderFct, ProjectFct, ToneTrackFct, ToneTimelineFct) {

    var wavArray = [];

    $scope.numMeasures = [];
    for (var i = 0; i < 60; i++) {
        $scope.numMeasures.push(i);
    }

    $scope.measureLength = 1;
    $scope.tracks = [];
    $scope.loading = true;

    ProjectFct.getProjectInfo('5594c20ad0759cd40ce51e14').then(function (project) {

        var loaded = 0;
        console.log('PROJECT', project);

        if (project.tracks.length) {
            project.tracks.forEach(function (track) {
                var doneLoading = function doneLoading() {
                    loaded++;
                    if (loaded === project.tracks.length) {
                        $scope.loading = false;
                        // Tone.Transport.start();
                    }
                };
                track.player = ToneTrackFct.createPlayer(track.url, doneLoading);
                ToneTimelineFct.addLoopToTimeline(track.player, track.location);
                $scope.tracks.push(track);
            });
        } else {
            for (var i = 0; i < 6; i++) {
                var obj = {};
                obj.name = 'Track ' + (i + 1);
                obj.location = [];
                $scope.tracks.push(obj);
            }
        }

        ToneTimelineFct.getTransport(project.endMeasure);
        ToneTimelineFct.changeBpm(project.bpm);
    });

    // AuthService.getLoggedInUser().then(function(aUser){
    //     $scope.theUser = aUser;
    //     // $stateParams.theID = aUser._id
    //     console.log("id", $stateParams);
    // });

    $scope.record = function (e, index) {

        e = e.toElement;

        // start recording
        console.log('start recording');

        if (!audioRecorder) return;

        e.classList.add('recording');
        audioRecorder.clear();
        audioRecorder.record();

        window.setTimeout(function () {
            audioRecorder.stop();
            e.classList.remove('recording');
            audioRecorder.getBuffers(gotBuffers);

            window.setTimeout(function () {
                $scope.tracks[index].rawAudio = window.latestRecording;
                // $scope.tracks[index].rawImage = window.latestRecordingImage;
            }, 500);
        }, 2000);
    };

    $scope.addTrack = function () {};

    $scope.sendToAWS = function () {

        var awsTracks = $scope.tracks.filter(function (track, index) {
            if (track.rawAudio) {
                return true;
            }
        });
        RecorderFct.sendToAWS(awsTracks, '5595a7faaa901ad63234f920').then(function (response) {
            // wave logic
            console.log('response from sendToAWS', response);
        });
    };
});

app.controller('UserController', function ($scope, $state, AuthService, $stateParams, userFactory) {

    AuthService.getLoggedInUser().then(function (loggedInUser) {
        console.log('getting');

        $scope.loggedInUser = loggedInUser;

        userFactory.getUserObj($stateParams.theID).then(function (user) {
            $scope.user = user;
            console.log('user is', user);
        });
    });

    $scope.displaySettings = function () {
        if ($scope.showSettings) $scope.showSettings = false;else $scope.showSettings = true;
        console.log($scope.showSettings);
    };

    $scope.follow = function (user) {
        userFactory.follow(user, $scope.loggedInUser).then(function (response) {
            console.log('Follow controller response', response);
        });
    };
});
app.factory('AnalyserFct', function () {

    var updateAnalysers = function updateAnalysers(analyserContext, analyserNode, continueUpdate) {

        function update() {
            var SPACING = 3;
            var BAR_WIDTH = 1;
            var numBars = Math.round(300 / SPACING);
            var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

            analyserNode.getByteFrequencyData(freqByteData);

            analyserContext.clearRect(0, 0, 300, 100);
            analyserContext.fillStyle = '#F6D565';
            analyserContext.lineCap = 'round';
            var multiplier = analyserNode.frequencyBinCount / numBars;

            // Draw rectangle for each frequency bin.
            for (var i = 0; i < numBars; ++i) {
                var magnitude = 0;
                var offset = Math.floor(i * multiplier);
                // gotta sum/average the block, or we miss narrow-bandwidth spikes
                for (var j = 0; j < multiplier; j++) magnitude += freqByteData[offset + j];
                magnitude = magnitude / multiplier;
                var magnitude2 = freqByteData[i * multiplier];
                analyserContext.fillStyle = 'hsl( ' + Math.round(i * 360 / numBars) + ', 100%, 50%)';
                analyserContext.fillRect(i * SPACING, 100, BAR_WIDTH, -magnitude);
            }
            if (continueUpdate) {
                window.requestAnimationFrame(update);
            }
        }
        window.requestAnimationFrame(update);
    };

    var cancelAnalyserUpdates = function cancelAnalyserUpdates(analyserId) {
        window.cancelAnimationFrame(analyserId);
    };
    return {
        updateAnalysers: updateAnalysers,
        cancelAnalyserUpdates: cancelAnalyserUpdates
    };
});
'use strict';
app.factory('HomeFct', function ($http) {

    return {
        getUser: function getUser(user) {
            return $http.get('/api/user', { params: { _id: user } }).then(function (success) {
                return success.data;
            });
        }
    };
});
'use strict';
app.factory('ProjectFct', function ($http) {

    var getProjectInfo = function getProjectInfo(projectId) {

        //if coming from HomeController and no Id is passed, set it to 'all'
        var projectid = projectId || 'all';
        return $http.get('/api/projects/' + projectid || projectid).then(function (response) {
            return response.data;
        });
    };

    var createAFork = function createAFork(project) {
        return $http.post('/api/projects/', project).then(function (fork) {
            return $http.put('api/users/', fork.data).then(function (response) {
                return response.data;
            });
        });
    };
    var newProject = function newProject(user) {
        return $http.post('/api/projects', { owner: user._id, name: 'Untitled', bpm: 120, endMeasure: 32 }).then(function (response) {
            return response.data;
        });
    };

    return {
        getProjectInfo: getProjectInfo,
        createAFork: createAFork,
        newProject: newProject
    };
});

'use strict';
app.factory('RandomGreetings', function () {

    var getRandomFromArray = function getRandomFromArray(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    };

    var greetings = ['Hello, world!', 'At long last, I live!', 'Hello, simple human.', 'What a beautiful day!', 'I\'m like any other project, except that I am yours. :)', 'This empty string is for Lindsay Levine.', 'こんにちは、ユーザー様。', 'Welcome. To. WEBSITE.', ':D'];

    return {
        greetings: greetings,
        getRandomGreeting: function getRandomGreeting() {
            return getRandomFromArray(greetings);
        }
    };
});

app.factory('RecorderFct', function ($http, AuthService, $q, ToneTrackFct, AnalyserFct) {

    var recorderInit = function recorderInit() {

        return $q(function (resolve, reject) {
            var Context = window.AudioContext || window.webkitAudioContext;
            var audioContext = new Context();
            var recorder;

            var navigator = window.navigator;
            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
            if (!navigator.cancelAnimationFrame) navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
            if (!navigator.requestAnimationFrame) navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

            // ask for permission
            navigator.getUserMedia({
                'audio': {
                    'mandatory': {
                        'googEchoCancellation': 'false',
                        'googAutoGainControl': 'false',
                        'googNoiseSuppression': 'false',
                        'googHighpassFilter': 'false'
                    },
                    'optional': []
                }
            }, function (stream) {
                var inputPoint = audioContext.createGain();

                // create an AudioNode from the stream.
                var realAudioInput = audioContext.createMediaStreamSource(stream);
                var audioInput = realAudioInput;
                audioInput.connect(inputPoint);

                // create analyser node
                var analyserNode = audioContext.createAnalyser();
                analyserNode.fftSize = 2048;
                inputPoint.connect(analyserNode);

                //create recorder
                recorder = new Recorder(inputPoint);
                var zeroGain = audioContext.createGain();
                zeroGain.gain.value = 0.0;
                inputPoint.connect(zeroGain);
                zeroGain.connect(audioContext.destination);

                resolve([recorder, analyserNode]);
            }, function (e) {
                alert('Error getting audio');
                // console.log(e);
                reject(e);
            });
        });
    };

    var recordStart = function recordStart(recorder) {
        recorder.clear();
        recorder.record();
    };

    var recordStop = function recordStop(index, recorder) {
        recorder.stop();
        return new $q(function (resolve, reject) {
            // e.classList.remove("recording");
            recorder.getBuffers(function (buffers) {
                //display wav image
                var canvas = document.getElementById('wavedisplay' + index);
                drawBuffer(300, 100, canvas.getContext('2d'), buffers[0]);
                window.latestBuffer = buffers[0];
                window.latestRecordingImage = canvas.toDataURL('image/png');

                // the ONLY time gotBuffers is called is right after a new recording is completed -
                // so here's where we should set up the download.
                recorder.exportWAV(function (blob) {
                    //needs a unique name
                    // Recorder.setupDownload( blob, "myRecording0.wav" );
                    //create loop time
                    ToneTrackFct.loopInitialize(blob, index, 'myRecording0.wav').then(resolve);
                });
            });
        });
    };

    var convertToBase64 = function convertToBase64(track) {
        console.log('each track', track);
        return new $q(function (resolve, reject) {
            var reader = new FileReader();

            if (track.rawAudio) {
                reader.readAsDataURL(track.rawAudio);
                reader.onloadend = function (e) {
                    resolve(reader.result);
                };
            } else {
                resolve(null);
            }
        });
    };

    return {
        sendToAWS: function sendToAWS(tracksArray, projectId) {

            var readPromises = tracksArray.map(convertToBase64);

            console.log('readPromises', readPromises);

            return $q.all(readPromises).then(function (storeData) {

                console.log('storeData', storeData);

                tracksArray.forEach(function (track, i) {
                    if (storeData[i]) {
                        track.rawAudio = storeData[i];
                    }
                });

                console.log('tracksArray', tracksArray);

                return $http.post('/api/aws/', { tracks: tracksArray, projectId: projectId }).then(function (response) {
                    console.log('response in sendToAWSFactory', response);
                    return response.data;
                });
            });
        },
        recorderInit: recorderInit,
        recordStart: recordStart,
        recordStop: recordStop
    };
});
'use strict';

'use strict';
app.factory('ToneTimelineFct', function ($http, $q) {

    var createTransport = function createTransport(loopEnd) {
        return new $q(function (resolve, reject) {
            Tone.Transport.loop = true;
            Tone.Transport.loopStart = '0m';
            Tone.Transport.loopEnd = loopEnd.toString() + 'm';
            var playHead = document.getElementById('playbackHead');

            createMetronome().then(function (metronome) {
                Tone.Transport.setInterval(function () {
                    var posArr = Tone.Transport.position.split(':');
                    var leftPos = (parseInt(posArr[0]) * 200 + parseInt(posArr[1]) * 50 + 500).toString() + 'px';
                    playHead.style.left = leftPos;
                    metronome.start();
                }, '1m');
                Tone.Transport.setInterval(function () {
                    console.log(Tone.Transport.position);
                    metronome.start();
                }, '4n');
                return resolve(metronome);
            });
        });
    };

    var changeBpm = function changeBpm(bpm) {
        Tone.Transport.bpm.value = bpm;
        return Tone.Transport;
    };

    var stopAll = function stopAll(tracks) {
        tracks.forEach(function (track) {
            if (track.player) track.player.stop();
        });
    };

    var muteAll = function muteAll(tracks) {
        tracks.forEach(function (track) {
            if (track.player) track.player.volume.value = -100;
        });
    };

    var unMuteAll = function unMuteAll(tracks) {
        tracks.forEach(function (track) {
            if (track.player) track.player.volume.value = 0;
        });
    };

    var createMetronome = function createMetronome() {
        return new $q(function (resolve, reject) {
            var met = new Tone.Player('/api/wav/Click1.wav', function () {
                return resolve(met);
            }).toMaster();
        });
    };

    var addLoopToTimeline = function addLoopToTimeline(player, startTimeArray) {

        if (startTimeArray.indexOf(0) === -1) {
            Tone.Transport.setTimeline(function () {
                player.stop();
            }, '0m');
        }

        startTimeArray.forEach(function (startTime) {

            var startTime = startTime.toString() + 'm';

            Tone.Transport.setTimeline(function () {
                console.log('Start', Tone.Transport.position);
                player.stop();
                player.start();
            }, startTime);

            // var stopTime = parseInt(startTime.substr(0, startTime.length-1)) + 1).toString() + startTime.substr(-1,1);
            //// console.log('STOP', stop);
            //// transport.setTimeline(function () {
            //// 	player.stop();
            //// }, stopTime);
        });
    };

    return {
        createTransport: createTransport,
        changeBpm: changeBpm,
        addLoopToTimeline: addLoopToTimeline,
        createMetronome: createMetronome,
        stopAll: stopAll,
        muteAll: muteAll,
        unMuteAll: unMuteAll
    };
});

'use strict';
app.factory('ToneTrackFct', function ($http, $q) {

    var createPlayer = function createPlayer(url, doneFn) {
        var player = new Tone.Player(url, doneFn);
        // TODO: remove toMaster
        player.toMaster();
        // player.sync();
        // player.loop = true;
        return player;
    };

    var loopInitialize = function loopInitialize(blob, index, filename) {
        return new $q(function (resolve, reject) {
            //PASSED A BLOB FROM RECORDERJSFACTORY - DROPPED ON MEASURE 0
            var url = (window.URL || window.webkitURL).createObjectURL(blob);
            var link = document.getElementById('save' + index);
            link.href = url;
            link.download = filename || 'output' + index + '.wav';
            window.latestRecording = blob;
            window.latestRecordingURL = url;
            var player;
            // TODO: remove toMaster
            player = new Tone.Player(link.href, function () {
                resolve(player);
            });
        });
    };

    var effectsInitialize = function effectsInitialize() {
        var chorus = new Tone.Chorus();
        var phaser = new Tone.Phaser();
        var distort = new Tone.Distortion();
        var pingpong = new Tone.PingPongDelay();
        chorus.wet.value = 0;
        phaser.wet.value = 0;
        distort.wet.value = 0;
        pingpong.wet.value = 0;
        chorus.connect(phaser);
        phaser.connect(distort);
        distort.connect(pingpong);
        pingpong.toMaster();

        return [chorus, phaser, distort, pingpong];
    };

    var createTimelineInstanceOfLoop = function createTimelineInstanceOfLoop(player, measure) {
        return Tone.Transport.setTimeline(function () {
            player.stop();
            player.start();
        }, measure + 'm');
    };

    var replaceTimelineLoop = function replaceTimelineLoop(player, oldTimelineId, newMeasure) {
        return new $q(function (resolve, reject) {
            console.log('old timeline id', oldTimelineId);
            Tone.Transport.clearTimeline(parseInt(oldTimelineId));
            // Tone.Transport.clearTimelines();
            resolve(createTimelineInstanceOfLoop(player, newMeasure));
        });
    };
    var deleteTimelineLoop = function deleteTimelineLoop(timelineId) {
        Tone.Transport.clearTimeline(parseInt(timelineId));
    };

    return {
        createPlayer: createPlayer,
        loopInitialize: loopInitialize,
        effectsInitialize: effectsInitialize,
        createTimelineInstanceOfLoop: createTimelineInstanceOfLoop,
        replaceTimelineLoop: replaceTimelineLoop,
        deleteTimelineLoop: deleteTimelineLoop
    };
});

app.factory('userFactory', function ($http) {
    return {
        getUserObj: function getUserObj(userID) {
            return $http.get('api/users', { params: { _id: userID } }).then(function (response) {
                console.log('resoonse is', response.data);
                return response.data;
            });
        },
        follow: function follow(user, loggedInUser) {
            return $http.put('api/users', { userToFollow: user, loggedInUser: loggedInUser }).then(function (response) {
                console.log('FollowUser Factory response', response.data);
                return response.data;
            });
        }
    };
});
app.directive('draggable', function () {
    return function (scope, element, attrs) {
        // this gives us the native JS object
        var el = element[0];

        el.draggable = true;

        el.addEventListener('dragstart', function (e) {

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('Text', this.id);
            this.classList.add('drag');

            var idx = scope.track.location.indexOf(parseInt(attrs.position));
            scope.track.location.splice(idx, 1);

            return false;
        }, false);

        el.addEventListener('dragend', function (e) {
            this.classList.remove('drag');
            return false;
        }, false);
    };
});

app.directive('droppable', function () {
    return {
        scope: {
            drop: '&' // parent
        },
        link: function link(scope, element) {
            // again we need the native object
            var el = element[0];

            el.addEventListener('dragover', function (e) {
                e.dataTransfer.dropEffect = 'move';
                // allows us to drop
                if (e.preventDefault) e.preventDefault();
                this.classList.add('over');
                return false;
            }, false);

            el.addEventListener('dragenter', function (e) {
                this.classList.add('over');
                return false;
            }, false);

            el.addEventListener('dragleave', function (e) {
                this.classList.remove('over');
                return false;
            }, false);

            el.addEventListener('drop', function (e) {
                // Stops some browsers from redirecting.
                if (e.stopPropagation) e.stopPropagation();

                this.classList.remove('over');

                // upon drop, changing position and updating track.location array on scope
                var item = document.getElementById(e.dataTransfer.getData('Text'));
                var xposition = parseInt(this.attributes.xposition.value);
                var childNodes = this.childNodes;
                var oldTimelineId;
                var theCanvas;

                for (var i = 0; i < childNodes.length; i++) {
                    if (childNodes[i].className === 'canvas-box') {

                        this.childNodes[i].appendChild(item);
                        scope.$parent.$parent.track.location.push(xposition);
                        scope.$parent.$parent.track.location.sort();

                        var canvasNode = this.childNodes[i].childNodes;

                        for (var j = 0; j < canvasNode.length; j++) {

                            if (canvasNode[j].nodeName === 'CANVAS') {
                                canvasNode[j].attributes.position.value = xposition;
                                oldTimelineId = canvasNode[j].attributes.timelineid.value;
                                theCanvas = canvasNode[j];
                            }
                        }
                    }
                }

                scope.$parent.$parent.moveInTimeline(oldTimelineId, xposition).then(function (newTimelineId) {
                    theCanvas.attributes.timelineid.value = newTimelineId;
                });

                // call the drop passed drop function
                scope.$apply('drop()');

                return false;
            }, false);
        }
    };
});

'use strict';
app.directive('fullstackLogo', function () {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/fullstack-logo/fullstack-logo.html'
    };
});
app.directive('projectdirective', function () {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/project/projectDirective.html',
        controller: 'projectdirectiveController'
    };
});

app.controller('projectdirectiveController', function ($scope, $stateParams, $state, ProjectFct, AuthService) {

    AuthService.getLoggedInUser().then(function (loggedInUser) {
        $scope.loggedInUser = loggedInUser;
        $scope.displayAProject = function (something) {
            console.log('THING', something);
            if ($scope.loggedInUser._id === $stateParams.theID) {
                $state.go('project', { projectID: something._id });
            }
            // console.log("displaying a project", projectID);
        };

        $scope.makeFork = function (project) {
            project.owner = loggedInUser._id;
            project.forkID = project._id;
            delete project._id;
            console.log(project);
            ProjectFct.createAFork(project).then(function (response) {
                console.log('Fork response is', response);
            });
        };
    });

    // $state.go('project')
});
'use strict';
app.directive('navbar', function ($rootScope, AuthService, AUTH_EVENTS, $state) {

    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'js/common/directives/navbar/navbar.html',
        link: function link(scope) {

            var setNavbar = function setNavbar() {
                AuthService.getLoggedInUser().then(function (user) {
                    scope.userId = user._id;
                    scope.items = [{ label: 'Home', state: 'project' }, { label: 'Members Only', state: 'userProfile({theID: userId})', auth: true }];
                });
            };
            setNavbar();

            scope.items = [{ label: 'Home', state: 'project' },
            // { label: 'Sign Up', state: 'signup' },
            { label: 'Members Only', state: 'userProfile', auth: true }];

            scope.user = null;

            scope.isLoggedIn = function () {
                return AuthService.isAuthenticated();
            };

            scope.logout = function () {
                AuthService.logout().then(function () {
                    $state.go('home');
                });
            };

            var setUser = function setUser() {
                AuthService.getLoggedInUser().then(function (user) {
                    scope.user = user;
                });
            };

            var removeUser = function removeUser() {
                scope.user = null;
            };

            setUser();

            $rootScope.$on(AUTH_EVENTS.loginSuccess, setUser);
            $rootScope.$on(AUTH_EVENTS.loginSuccess, setNavbar);
            $rootScope.$on(AUTH_EVENTS.logoutSuccess, removeUser);
            $rootScope.$on(AUTH_EVENTS.logoutSuccess, setNavbar);
            $rootScope.$on(AUTH_EVENTS.sessionTimeout, removeUser);
        }

    };
});
'use strict';
app.directive('randoGreeting', function (RandomGreetings) {

    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/rando-greeting/rando-greeting.html',
        link: function link(scope) {
            scope.greeting = RandomGreetings.getRandomGreeting();
        }
    };
});
app.directive('ximTrack', function ($rootScope, $stateParams, $compile, RecorderFct, ProjectFct, ToneTrackFct, ToneTimelineFct, AnalyserFct, $q) {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/track/track.html',
        link: function link(scope, element, attrs) {
            scope.effectWetnesses = [0, 0, 0, 0];
            setTimeout(function () {
                var canvasRow = element[0].getElementsByClassName('canvas-box');

                for (var i = 0; i < canvasRow.length; i++) {

                    var canvasClasses = canvasRow[i].parentNode.classList;

                    for (var j = 0; j < canvasClasses.length; j++) {
                        if (canvasClasses[j] === 'taken') {
                            angular.element(canvasRow[i]).append($compile('<canvas width=\'198\' height=\'98\' id=\'wavedisplay\' class=\'item\' style=\'position: absolute;\' draggable></canvas>')(scope));
                        }
                    }
                }
            }, 0);

            scope.dropInTimeline = function (index) {

                scope.track.player.loop = false;
                scope.track.player.stop();
                scope.track.onTimeline = true;
                var position = 0;
                var canvasRow = element[0].getElementsByClassName('canvas-box');

                if (scope.track.location.length) {
                    // drop the loop on the first available index				
                    while (scope.track.location.indexOf(position) > -1) {
                        position++;
                    }
                }

                // adding raw image to db
                if (!scope.track.img) {
                    scope.track.img = window.latestRecordingImage.replace(/^data:image\/png;base64,/, '');
                }
                console.log('pushing', position);
                scope.track.location.push(position);
                scope.track.location.sort();
                var timelineId = ToneTrackFct.createTimelineInstanceOfLoop(scope.track.player, position);
                angular.element(canvasRow[position]).append($compile('<canvas width=\'198\' height=\'98\' position=\'' + position + '\' timelineId=\'' + timelineId + '\' id=\'mdisplay' + index + '-' + position + '\' class=\'item trackLoop' + index + '\' style=\'position: absolute;\' draggable></canvas>')(scope));
                var canvas = document.getElementById('mdisplay' + index + '-' + position);
                drawBuffer(198, 98, canvas.getContext('2d'), scope.track.buffer);
                console.log('track', scope.track);
            };

            scope.moveInTimeline = function (oldTimelineId, newMeasure) {
                return new $q(function (resolve, reject) {
                    // console.log('ELEMENT', oldTimelineId, newMeasure);
                    ToneTrackFct.replaceTimelineLoop(scope.track.player, oldTimelineId, newMeasure).then(resolve);
                });
            };

            scope.appearOrDisappear = function (position) {
                var trackIndex = scope.$parent.tracks.indexOf(scope.track);
                var loopIndex = scope.track.location.indexOf(position);
                console.log('IND, POS', trackIndex, position);
                console.log(scope.track.location.indexOf(position));
                if (scope.track.onTimeline) {
                    if (loopIndex === -1) {
                        var canvasRow = element[0].getElementsByClassName('canvas-box');
                        scope.track.location.push(position);
                        scope.track.location.sort();
                        console.log(scope.track.location);
                        var timelineId = ToneTrackFct.createTimelineInstanceOfLoop(scope.track.player, position);
                        angular.element(canvasRow[position]).append($compile('<canvas width=\'198\' height=\'98\' position=\'' + position + '\' timelineId=\'' + timelineId + '\' id=\'mdisplay' + trackIndex + '-' + position + '\' class=\'item trackLoop' + trackIndex + '\' style=\'position: absolute;\' draggable></canvas>')(scope));
                        // console.log('track', scope.track);
                        var canvas = document.getElementById('mdisplay' + trackIndex + '-' + position);
                        drawBuffer(198, 98, canvas.getContext('2d'), scope.track.buffer);
                    } else {
                        //remove canvas item

                        var removeElement = function removeElement(element) {
                            element && element.parentNode && element.parentNode.removeChild(element);
                        };

                        var canvas = document.getElementById('mdisplay' + trackIndex + '-' + position);
                        //remove from locations array
                        scope.track.location.splice(loopIndex, 1);
                        //remove timelineId
                        ToneTrackFct.deleteTimelineLoop(canvas.attributes.timelineid.value);
                        removeElement(canvas);
                    }
                } else {
                    console.log('NO DROP');
                }
            };

            scope.reRecord = function (index) {
                console.log('RERECORD');
                console.log(scope.track);
                //change all params back as if empty track
                scope.track.empty = true;
                scope.track.onTimeline = false;
                scope.track.player = null;
                scope.track.silence = false;
                scope.track.rawAudio = null;
                scope.track.img = null;
                scope.track.previewing = false;
                //dispose of effectsRack
                scope.track.effectsRack.forEach(function (effect) {
                    effect.dispose();
                });
                scope.track.effectsRack = ToneTrackFct.effectsInitialize();
                scope.track.location = [];
                //remove all loops from UI
                var loopsUI = document.getElementsByClassName('trackLoop' + index.toString());
                while (loopsUI.length !== 0) {
                    for (var i = 0; i < loopsUI.length; i++) {
                        loopsUI[i].parentNode.removeChild(loopsUI[i]);
                    }
                    var loopsUI = document.getElementsByClassName('trackLoop' + index.toString());
                }
            };

            scope.solo = function () {
                var otherTracks = scope.$parent.tracks.map(function (track) {
                    if (track !== scope.track) {
                        track.silence = true;
                        return track;
                    }
                }).filter(function (track) {
                    if (track && track.player) return true;
                });

                console.log(otherTracks);
                ToneTimelineFct.muteAll(otherTracks);
                scope.track.silence = false;
                scope.track.player.volume.value = 0;
            };

            scope.silence = function () {
                if (!scope.track.silence) {
                    scope.track.player.volume.value = -100;
                    scope.track.silence = true;
                } else {
                    scope.track.player.volume.value = 0;
                    scope.track.silence = false;
                }
            };

            scope.record = function (index) {
                ToneTimelineFct.muteAll(scope.$parent.tracks);
                var recorder = scope.recorder;

                var continueUpdate = true;

                //analyser stuff
                var canvas = document.getElementById('analyser' + index);
                var analyserContext = canvas.getContext('2d');
                var analyserNode = scope.analyserNode;
                var analyserId = window.requestAnimationFrame(update);

                scope.track.recording = true;
                scope.track.empty = true;
                RecorderFct.recordStart(recorder);
                scope.track.previewing = false;

                function update() {
                    var SPACING = 3;
                    var BAR_WIDTH = 1;
                    var numBars = Math.round(300 / SPACING);
                    var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

                    analyserNode.getByteFrequencyData(freqByteData);

                    analyserContext.clearRect(0, 0, 300, 100);
                    analyserContext.fillStyle = '#F6D565';
                    analyserContext.lineCap = 'round';
                    var multiplier = analyserNode.frequencyBinCount / numBars;

                    // Draw rectangle for each frequency bin.
                    for (var i = 0; i < numBars; ++i) {
                        var magnitude = 0;
                        var offset = Math.floor(i * multiplier);
                        // gotta sum/average the block, or we miss narrow-bandwidth spikes
                        for (var j = 0; j < multiplier; j++) magnitude += freqByteData[offset + j];
                        magnitude = magnitude / multiplier;
                        var magnitude2 = freqByteData[i * multiplier];
                        analyserContext.fillStyle = 'hsl( ' + Math.round(i * 360 / numBars) + ', 100%, 50%)';
                        analyserContext.fillRect(i * SPACING, 100, BAR_WIDTH, -magnitude);
                    }
                    if (continueUpdate) {
                        window.requestAnimationFrame(update);
                    }
                }

                window.setTimeout(function () {
                    RecorderFct.recordStop(index, recorder).then(function (player) {
                        scope.track.recording = false;
                        scope.track.empty = false;
                        continueUpdate = false;
                        window.cancelAnimationFrame(analyserId);
                        scope.track.player = player;
                        scope.track.player.loop = true;
                        scope.track.buffer = window.latestBuffer;
                        scope.track.rawAudio = window.latestRecording;
                        player.connect(scope.track.effectsRack[0]);
                        scope.$parent.metronome.stop();
                        window.clearInterval(click);

                        scope.$parent.stop();
                        ToneTimelineFct.unMuteAll(scope.$parent.tracks);
                    });
                }, 4000);

                window.setTimeout(function () {
                    RecorderFct.recordStart(recorder, index);
                }, 2000);
                scope.$parent.metronome.start();

                var click = window.setInterval(function () {
                    scope.$parent.metronome.stop();
                    scope.$parent.metronome.start();
                }, 500);
            };
            scope.preview = function (currentlyPreviewing) {
                console.log(currentlyPreviewing);
                if (currentlyPreviewing) {
                    scope.track.player.stop();
                    scope.track.previewing = false;
                } else {
                    scope.track.player.start();
                    scope.track.previewing = true;
                }
            };

            scope.changeWetness = function (effect, amount) {
                console.log(effect);
                console.log(amount);

                effect.wet.value = amount / 1000;
            };
        }

    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImZzYS9mc2EtcHJlLWJ1aWx0LmpzIiwiaG9tZS9ob21lLmpzIiwibG9naW4vbG9naW4uanMiLCJwcm9qZWN0L3Byb2plY3QuanMiLCJzaWdudXAvc2lnbnVwLmpzIiwidXNlci91c2VycHJvZmlsZS5qcyIsImNvbW1vbi9jb250cm9sbGVycy9Ib21lQ29udHJvbGxlci5qcyIsImNvbW1vbi9jb250cm9sbGVycy9OZXdQcm9qZWN0Q29udHJvbGxlci5qcyIsImNvbW1vbi9jb250cm9sbGVycy9UaW1lbGluZUNvbnRyb2xsZXIuanMiLCJjb21tb24vY29udHJvbGxlcnMvVXNlckNvbnRyb2xsZXIuanMiLCJjb21tb24vZmFjdG9yaWVzL0FuYWx5c2VyRmN0LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9Ib21lRmN0LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9Qcm9qZWN0RmN0LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9SYW5kb21HcmVldGluZ3MuanMiLCJjb21tb24vZmFjdG9yaWVzL1JlY29yZGVyRmN0LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9Tb2NrZXQuanMiLCJjb21tb24vZmFjdG9yaWVzL1RvbmVUaW1lbGluZUZjdC5qcyIsImNvbW1vbi9mYWN0b3JpZXMvVG9uZVRyYWNrRmN0LmpzIiwiY29tbW9uL2ZhY3Rvcmllcy91c2VyRmFjdG9yeS5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL2RyYWdnYWJsZS9kcmFnZ2FibGUuanMiLCJjb21tb24vZGlyZWN0aXZlcy9mdWxsc3RhY2stbG9nby9mdWxsc3RhY2stbG9nby5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL3Byb2plY3QvcHJvamVjdERpcmVjdGl2ZS5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuanMiLCJjb21tb24vZGlyZWN0aXZlcy9yYW5kby1ncmVldGluZy9yYW5kby1ncmVldGluZy5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL3RyYWNrL3RyYWNrLmpzIl0sIm5hbWVzIjpb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QSxNQUFBLENBQUEsRUFBQSxRQUFBLENBQUEsQ0FBQTtBQUNBLHVCQUFBLEVBQUEsQ0FBQSxNQUFBLENBQUEsUUFBQSxDQUFBLENBQUE7YUFDQTtTQUNBLENBQUE7S0FDQSxDQUFBLENBQUE7O0FBRUEsT0FBQSxDQUFBLE1BQUEsQ0FBQSxVQUFBLGFBQUEsRUFBQTtBQUNBLHFCQUFBLENBQUEsWUFBQSxDQUFBLElBQUEsQ0FBQSxDQUNBLFdBQUEsRUFDQSxVQUFBLFNBQUEsRUFBQTtBQUNBLG1CQUFBLFNBQUEsQ0FBQSxHQUFBLENBQUEsaUJBQUEsQ0FBQSxDQUFBO1NBQ0EsQ0FDQSxDQUFBLENBQUE7S0FDQSxDQUFBLENBQUE7O0FBRUEsT0FBQSxDQUFBLE9BQUEsQ0FBQSxhQUFBLEVBQUEsVUFBQSxLQUFBLEVBQUEsT0FBQSxFQUFBLFVBQUEsRUFBQSxXQUFBLEVBQUEsRUFBQSxFQUFBOzs7O0FBSUEsWUFBQSxDQUFBLGVBQUEsR0FBQSxZQUFBO0FBQ0EsbUJBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxJQUFBLENBQUE7U0FDQSxDQUFBOztBQUVBLFlBQUEsQ0FBQSxlQUFBLEdBQUEsWUFBQTs7Ozs7O0FBTUEsZ0JBQUEsSUFBQSxDQUFBLGVBQUEsRUFBQSxFQUFBO0FBQ0EsdUJBQUEsRUFBQSxDQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsSUFBQSxDQUFBLENBQUE7YUFDQTs7Ozs7QUFLQSxtQkFBQSxLQUFBLENBQUEsR0FBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxZQUFBO0FBQ0EsdUJBQUEsSUFBQSxDQUFBO2FBQ0EsQ0FBQSxDQUFBO1NBRUEsQ0FBQTs7QUFFQSxZQUFBLENBQUEsS0FBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0FBQ0EsbUJBQUEsS0FBQSxDQUFBLElBQUEsQ0FBQSxRQUFBLEVBQUEsV0FBQSxDQUFBLENBQ0EsSUFBQSxDQUFBLGlCQUFBLENBQUEsU0FDQSxDQUFBLFVBQUEsUUFBQSxFQUFBO0FBQ0EsdUJBQUEsRUFBQSxDQUFBLE1BQUEsQ0FBQSxFQUFBLE9BQUEsRUFBQSw0QkFBQSxFQUFBLENBQUEsQ0FBQTthQUNBLENBQUEsQ0FBQTtTQUNBLENBQUE7O0FBRUEsWUFBQSxDQUFBLE1BQUEsR0FBQSxZQUFBO0FBQ0EsbUJBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsWUFBQTtBQUNBLHVCQUFBLENBQUEsT0FBQSxFQUFBLENBQUE7QUFDQSwwQkFBQSxDQUFBLFVBQUEsQ0FBQSxXQUFBLENBQUEsYUFBQSxDQUFBLENBQUE7YUFDQSxDQUFBLENBQUE7U0FDQSxDQUFBOztBQUVBLGlCQUFBLGlCQUFBLENBQUEsUUFBQSxFQUFBO0FBQ0EsZ0JBQUEsSUFBQSxHQUFBLFFBQUEsQ0FBQSxJQUFBLENBQUE7QUFDQSxtQkFBQSxDQUFBLE1BQUEsQ0FBQSxJQUFBLENBQUEsRUFBQSxFQUFBLElBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQTtBQUNBLHNCQUFBLENBQUEsVUFBQSxDQUFBLFdBQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQTtBQUNBLG1CQUFBLElBQUEsQ0FBQSxJQUFBLENBQUE7U0FDQTs7QUFFQSxZQUFBLENBQUEsTUFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0FBQ0EsbUJBQUEsQ0FBQSxHQUFBLENBQUEsV0FBQSxDQUFBLENBQUE7QUFDQSxtQkFBQSxLQUFBLENBQUEsSUFBQSxDQUFBLFNBQUEsRUFBQSxXQUFBLENBQUEsQ0FDQSxJQUFBLENBQUEsaUJBQUEsQ0FBQSxTQUNBLENBQUEsVUFBQSxRQUFBLEVBQUE7QUFDQSx1QkFBQSxFQUFBLENBQUEsTUFBQSxDQUFBLEVBQUEsT0FBQSxFQUFBLDZCQUFBLEVBQUEsQ0FBQSxDQUFBO2FBQ0EsQ0FBQSxDQUFBO1NBQ0EsQ0FBQTtLQUNBLENBQUEsQ0FBQTs7QUFFQSxPQUFBLENBQUEsT0FBQSxDQUFBLFNBQUEsRUFBQSxVQUFBLFVBQUEsRUFBQSxXQUFBLEVBQUE7O0FBRUEsWUFBQSxJQUFBLEdBQUEsSUFBQSxDQUFBOztBQUVBLGtCQUFBLENBQUEsR0FBQSxDQUFBLFdBQUEsQ0FBQSxnQkFBQSxFQUFBLFlBQUE7QUFDQSxnQkFBQSxDQUFBLE9BQUEsRUFBQSxDQUFBO1NBQ0EsQ0FBQSxDQUFBOztBQUVBLGtCQUFBLENBQUEsR0FBQSxDQUFBLFdBQUEsQ0FBQSxjQUFBLEVBQUEsWUFBQTtBQUNBLGdCQUFBLENBQUEsT0FBQSxFQUFBLENBQUE7U0FDQSxDQUFBLENBQUE7O0FBRUEsWUFBQSxDQUFBLEVBQUEsR0FBQSxJQUFBLENBQUE7QUFDQSxZQUFBLENBQUEsSUFBQSxHQUFBLElBQUEsQ0FBQTs7QUFFQSxZQUFBLENBQUEsTUFBQSxHQUFBLFVBQUEsU0FBQSxFQUFBLElBQUEsRUFBQTtBQUNBLGdCQUFBLENBQUEsRUFBQSxHQUFBLFNBQUEsQ0FBQTtBQUNBLGdCQUFBLENBQUEsSUFBQSxHQUFBLElBQUEsQ0FBQTtTQUNBLENBQUE7O0FBRUEsWUFBQSxDQUFBLE9BQUEsR0FBQSxZQUFBO0FBQ0EsZ0JBQUEsQ0FBQSxFQUFBLEdBQUEsSUFBQSxDQUFBO0FBQ0EsZ0JBQUEsQ0FBQSxJQUFBLEdBQUEsSUFBQSxDQUFBO1NBQ0EsQ0FBQTtLQUVBLENBQUEsQ0FBQTtDQUVBLENBQUEsRUFBQSxDQUFBO0FDeElBLFlBQUEsQ0FBQTtBQUNBLEdBQUEsQ0FBQSxNQUFBLENBQUEsVUFBQSxjQUFBLEVBQUE7QUFDQSxrQkFBQSxDQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUE7QUFDQSxXQUFBLEVBQUEsR0FBQTtBQUNBLG1CQUFBLEVBQUEsbUJBQUE7S0FDQSxDQUFBLENBQUE7O0FBRUEsa0JBQUEsQ0FBQSxLQUFBLENBQUEsY0FBQSxFQUFBO0FBQ0EsV0FBQSxFQUFBLFVBQUE7QUFDQSxtQkFBQSxFQUFBLHNCQUFBO0tBQ0EsQ0FBQSxDQUFBO0NBQ0EsQ0FBQSxDQUFBOztBQ1hBLEdBQUEsQ0FBQSxNQUFBLENBQUEsVUFBQSxjQUFBLEVBQUE7O0FBRUEsa0JBQUEsQ0FBQSxLQUFBLENBQUEsT0FBQSxFQUFBO0FBQ0EsV0FBQSxFQUFBLFFBQUE7QUFDQSxtQkFBQSxFQUFBLHFCQUFBO0FBQ0Esa0JBQUEsRUFBQSxXQUFBO0tBQ0EsQ0FBQSxDQUFBO0NBRUEsQ0FBQSxDQUFBOztBQUVBLEdBQUEsQ0FBQSxVQUFBLENBQUEsV0FBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLFdBQUEsRUFBQSxNQUFBLEVBQUE7O0FBRUEsVUFBQSxDQUFBLEtBQUEsR0FBQSxFQUFBLENBQUE7QUFDQSxVQUFBLENBQUEsS0FBQSxHQUFBLElBQUEsQ0FBQTs7QUFFQSxVQUFBLENBQUEsU0FBQSxHQUFBLFVBQUEsU0FBQSxFQUFBOztBQUVBLGNBQUEsQ0FBQSxLQUFBLEdBQUEsSUFBQSxDQUFBOztBQUVBLG1CQUFBLENBQUEsS0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxZQUFBO0FBQ0Esa0JBQUEsQ0FBQSxFQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7U0FDQSxDQUFBLFNBQUEsQ0FBQSxZQUFBO0FBQ0Esa0JBQUEsQ0FBQSxLQUFBLEdBQUEsNEJBQUEsQ0FBQTtTQUNBLENBQUEsQ0FBQTtLQUVBLENBQUE7Q0FFQSxDQUFBLENBQUE7QUMzQkEsWUFBQSxDQUFBO0FBQ0EsR0FBQSxDQUFBLE1BQUEsQ0FBQSxVQUFBLGNBQUEsRUFBQTtBQUNBLGtCQUFBLENBQUEsS0FBQSxDQUFBLFNBQUEsRUFBQTtBQUNBLFdBQUEsRUFBQSxxQkFBQTtBQUNBLG1CQUFBLEVBQUEseUJBQUE7S0FDQSxDQUFBLENBQUE7Q0FDQSxDQUFBLENBQUE7O0FBRUEsR0FBQSxDQUFBLFVBQUEsQ0FBQSxtQkFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLFlBQUEsRUFBQSxRQUFBLEVBQUEsV0FBQSxFQUFBLFVBQUEsRUFBQSxZQUFBLEVBQUEsZUFBQSxFQUFBLFdBQUEsRUFBQTs7QUFFQSxVQUFBLENBQUEsTUFBQSxHQUFBLFlBQUE7QUFDQSxjQUFBLENBQUEsSUFBQSxFQUFBLENBQUE7S0FDQSxDQUFBOztBQUVBLFFBQUEsVUFBQSxHQUFBLENBQUEsQ0FBQTs7O0FBR0EsVUFBQSxDQUFBLFdBQUEsR0FBQSxDQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsRUFBQSxFQUFBLENBQUEsQ0FBQTs7O0FBR0EsVUFBQSxDQUFBLGFBQUEsR0FBQSxDQUFBLENBQUE7OztBQUdBLGVBQUEsQ0FBQSxZQUFBLEVBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxNQUFBLEVBQUE7QUFDQSxjQUFBLENBQUEsUUFBQSxHQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtBQUNBLGNBQUEsQ0FBQSxZQUFBLEdBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0tBQ0EsQ0FBQSxTQUFBLENBQUEsVUFBQSxDQUFBLEVBQUE7QUFDQSxhQUFBLENBQUEscUJBQUEsQ0FBQSxDQUFBO0FBQ0EsZUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtLQUNBLENBQUEsQ0FBQTs7QUFFQSxVQUFBLENBQUEsYUFBQSxHQUFBLENBQUEsQ0FBQTtBQUNBLFVBQUEsQ0FBQSxZQUFBLEdBQUEsS0FBQSxDQUFBO0FBQ0EsVUFBQSxDQUFBLE1BQUEsR0FBQSxFQUFBLENBQUE7QUFDQSxVQUFBLENBQUEsT0FBQSxHQUFBLElBQUEsQ0FBQTtBQUNBLFVBQUEsQ0FBQSxTQUFBLEdBQUEsWUFBQSxDQUFBLFNBQUEsQ0FBQTtBQUNBLFVBQUEsQ0FBQSxRQUFBLEdBQUEsQ0FBQSxDQUFBO0FBQ0EsVUFBQSxDQUFBLE9BQUEsR0FBQSxLQUFBLENBQUE7O0FBRUEsY0FBQSxDQUFBLGNBQUEsQ0FBQSxNQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLFVBQUEsT0FBQSxFQUFBO0FBQ0EsWUFBQSxNQUFBLEdBQUEsQ0FBQSxDQUFBO0FBQ0EsZUFBQSxDQUFBLEdBQUEsQ0FBQSxTQUFBLEVBQUEsT0FBQSxDQUFBLENBQUE7QUFDQSxjQUFBLENBQUEsV0FBQSxHQUFBLE9BQUEsQ0FBQSxJQUFBLENBQUE7O0FBRUEsWUFBQSxPQUFBLENBQUEsTUFBQSxDQUFBLE1BQUEsRUFBQTtBQUNBLG1CQUFBLENBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxVQUFBLEtBQUEsRUFBQTtBQUNBLG9CQUFBLFdBQUEsR0FBQSxTQUFBLFdBQUEsR0FBQTtBQUNBLDBCQUFBLEVBQUEsQ0FBQTtBQUNBLHdCQUFBLE1BQUEsS0FBQSxPQUFBLENBQUEsTUFBQSxDQUFBLE1BQUEsRUFBQTtBQUNBLDhCQUFBLENBQUEsT0FBQSxHQUFBLEtBQUEsQ0FBQTs7cUJBRUE7aUJBQ0EsQ0FBQTtBQUNBLG9CQUFBLEdBQUEsR0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLEVBQUEsS0FBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBO0FBQ0Esb0JBQUEsR0FBQSxHQUFBLENBQUEsR0FBQSxVQUFBLEVBQUEsVUFBQSxHQUFBLEdBQUEsR0FBQSxDQUFBLENBQUE7O0FBRUEscUJBQUEsQ0FBQSxLQUFBLEdBQUEsS0FBQSxDQUFBO0FBQ0EscUJBQUEsQ0FBQSxTQUFBLEdBQUEsS0FBQSxDQUFBO0FBQ0EscUJBQUEsQ0FBQSxPQUFBLEdBQUEsS0FBQSxDQUFBOzs7QUFHQSxxQkFBQSxDQUFBLE1BQUEsR0FBQSxZQUFBLENBQUEsWUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsV0FBQSxDQUFBLENBQUE7O0FBRUEscUJBQUEsQ0FBQSxXQUFBLEdBQUEsWUFBQSxDQUFBLGlCQUFBLEVBQUEsQ0FBQTtBQUNBLHFCQUFBLENBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxLQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7O0FBRUEsb0JBQUEsS0FBQSxDQUFBLFFBQUEsQ0FBQSxNQUFBLEVBQUE7QUFDQSxtQ0FBQSxDQUFBLGlCQUFBLENBQUEsS0FBQSxDQUFBLE1BQUEsRUFBQSxLQUFBLENBQUEsUUFBQSxDQUFBLENBQUE7QUFDQSx5QkFBQSxDQUFBLFVBQUEsR0FBQSxJQUFBLENBQUE7aUJBQ0EsTUFBQTtBQUNBLHlCQUFBLENBQUEsVUFBQSxHQUFBLEtBQUEsQ0FBQTtpQkFDQTs7QUFFQSxzQkFBQSxDQUFBLE1BQUEsQ0FBQSxJQUFBLENBQUEsS0FBQSxDQUFBLENBQUE7YUFDQSxDQUFBLENBQUE7U0FDQSxNQUFBO0FBQ0Esa0JBQUEsQ0FBQSxVQUFBLEdBQUEsRUFBQSxDQUFBO0FBQ0EsaUJBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7QUFDQSxvQkFBQSxHQUFBLEdBQUEsRUFBQSxDQUFBO0FBQ0EsbUJBQUEsQ0FBQSxLQUFBLEdBQUEsSUFBQSxDQUFBO0FBQ0EsbUJBQUEsQ0FBQSxTQUFBLEdBQUEsS0FBQSxDQUFBO0FBQ0EsbUJBQUEsQ0FBQSxVQUFBLEdBQUEsS0FBQSxDQUFBO0FBQ0EsbUJBQUEsQ0FBQSxVQUFBLEdBQUEsS0FBQSxDQUFBO0FBQ0EsbUJBQUEsQ0FBQSxPQUFBLEdBQUEsS0FBQSxDQUFBO0FBQ0EsbUJBQUEsQ0FBQSxXQUFBLEdBQUEsWUFBQSxDQUFBLGlCQUFBLEVBQUEsQ0FBQTtBQUNBLG1CQUFBLENBQUEsTUFBQSxHQUFBLElBQUEsQ0FBQTtBQUNBLG1CQUFBLENBQUEsSUFBQSxHQUFBLFFBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUE7QUFDQSxtQkFBQSxDQUFBLFFBQUEsR0FBQSxFQUFBLENBQUE7QUFDQSxzQkFBQSxDQUFBLE1BQUEsQ0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLENBQUE7YUFDQTtTQUNBOzs7O0FBSUEsY0FBQSxDQUFBLFdBQUEsR0FBQSxFQUFBLENBQUE7QUFDQSxZQUFBLFVBQUEsR0FBQSxFQUFBLEVBQUEsVUFBQSxHQUFBLEVBQUEsQ0FBQTtBQUNBLGFBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxVQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7QUFDQSxrQkFBQSxDQUFBLFdBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7U0FDQTtBQUNBLGVBQUEsQ0FBQSxHQUFBLENBQUEsVUFBQSxFQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQTs7QUFJQSx1QkFBQSxDQUFBLGVBQUEsQ0FBQSxPQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsSUFBQSxDQUFBLFVBQUEsU0FBQSxFQUFBO0FBQ0Esa0JBQUEsQ0FBQSxTQUFBLEdBQUEsU0FBQSxDQUFBO1NBQ0EsQ0FBQSxDQUFBO0FBQ0EsdUJBQUEsQ0FBQSxTQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO0tBRUEsQ0FBQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxjQUFBLEdBQUEsVUFBQSxLQUFBLEVBQUE7QUFDQSxZQUFBLEtBQUEsR0FBQSxLQUFBLENBQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBO0tBQ0EsQ0FBQTs7QUFFQSxVQUFBLENBQUEsUUFBQSxHQUFBLFlBQUEsRUFFQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxJQUFBLEdBQUEsWUFBQTtBQUNBLGNBQUEsQ0FBQSxPQUFBLEdBQUEsSUFBQSxDQUFBO0FBQ0EsWUFBQSxDQUFBLFNBQUEsQ0FBQSxRQUFBLEdBQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxRQUFBLEVBQUEsR0FBQSxNQUFBLENBQUE7QUFDQSxZQUFBLENBQUEsU0FBQSxDQUFBLEtBQUEsRUFBQSxDQUFBO0tBQ0EsQ0FBQTtBQUNBLFVBQUEsQ0FBQSxLQUFBLEdBQUEsWUFBQTtBQUNBLGNBQUEsQ0FBQSxPQUFBLEdBQUEsS0FBQSxDQUFBO0FBQ0EsY0FBQSxDQUFBLFNBQUEsQ0FBQSxJQUFBLEVBQUEsQ0FBQTtBQUNBLHVCQUFBLENBQUEsT0FBQSxDQUFBLE1BQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQTtBQUNBLGNBQUEsQ0FBQSxRQUFBLEdBQUEsSUFBQSxDQUFBLFNBQUEsQ0FBQSxRQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0FBQ0EsZUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLEVBQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBO0FBQ0EsWUFBQSxRQUFBLEdBQUEsUUFBQSxDQUFBLGNBQUEsQ0FBQSxjQUFBLENBQUEsQ0FBQTtBQUNBLGdCQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsR0FBQSxDQUFBLE1BQUEsQ0FBQSxRQUFBLEdBQUEsR0FBQSxHQUFBLEdBQUEsQ0FBQSxDQUFBLFFBQUEsRUFBQSxHQUFBLElBQUEsQ0FBQTtBQUNBLFlBQUEsQ0FBQSxTQUFBLENBQUEsS0FBQSxFQUFBLENBQUE7S0FDQSxDQUFBO0FBQ0EsVUFBQSxDQUFBLElBQUEsR0FBQSxZQUFBO0FBQ0EsY0FBQSxDQUFBLE9BQUEsR0FBQSxLQUFBLENBQUE7QUFDQSxjQUFBLENBQUEsU0FBQSxDQUFBLElBQUEsRUFBQSxDQUFBO0FBQ0EsdUJBQUEsQ0FBQSxPQUFBLENBQUEsTUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBO0FBQ0EsY0FBQSxDQUFBLFFBQUEsR0FBQSxDQUFBLENBQUE7QUFDQSxZQUFBLFFBQUEsR0FBQSxRQUFBLENBQUEsY0FBQSxDQUFBLGNBQUEsQ0FBQSxDQUFBO0FBQ0EsZ0JBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxHQUFBLE9BQUEsQ0FBQTtBQUNBLFlBQUEsQ0FBQSxTQUFBLENBQUEsSUFBQSxFQUFBLENBQUE7S0FDQSxDQUFBO0FBQ0EsVUFBQSxDQUFBLFVBQUEsR0FBQSxVQUFBLE9BQUEsRUFBQTtBQUNBLGNBQUEsQ0FBQSxZQUFBLEdBQUEsS0FBQSxDQUFBO0tBQ0EsQ0FBQTs7QUFFQSxVQUFBLENBQUEsZUFBQSxHQUFBLFlBQUE7QUFDQSxZQUFBLE1BQUEsQ0FBQSxTQUFBLENBQUEsTUFBQSxDQUFBLEtBQUEsS0FBQSxDQUFBLEVBQUE7QUFDQSxrQkFBQSxDQUFBLFNBQUEsQ0FBQSxNQUFBLENBQUEsS0FBQSxHQUFBLENBQUEsR0FBQSxDQUFBO1NBQ0EsTUFBQTtBQUNBLGtCQUFBLENBQUEsU0FBQSxDQUFBLE1BQUEsQ0FBQSxLQUFBLEdBQUEsQ0FBQSxDQUFBO1NBQ0E7S0FDQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxTQUFBLEdBQUEsWUFBQTs7QUFFQSxtQkFBQSxDQUFBLFNBQUEsQ0FBQSxNQUFBLENBQUEsTUFBQSxFQUFBLE1BQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxRQUFBLEVBQUE7O0FBRUEsbUJBQUEsQ0FBQSxHQUFBLENBQUEseUJBQUEsRUFBQSxRQUFBLENBQUEsQ0FBQTtTQUVBLENBQUEsQ0FBQTtLQUNBLENBQUE7O0FBRUEsVUFBQSxDQUFBLFVBQUEsR0FBQSxZQUFBO0FBQ0EsZUFBQSxXQUFBLENBQUEsZUFBQSxFQUFBLENBQUE7S0FDQSxDQUFBO0NBQ0EsQ0FBQSxDQUFBO0FDdEtBLEdBQUEsQ0FBQSxNQUFBLENBQUEsVUFBQSxjQUFBLEVBQUE7O0FBRUEsa0JBQUEsQ0FBQSxLQUFBLENBQUEsUUFBQSxFQUFBO0FBQ0EsV0FBQSxFQUFBLFNBQUE7QUFDQSxtQkFBQSxFQUFBLHVCQUFBO0FBQ0Esa0JBQUEsRUFBQSxZQUFBO0tBQ0EsQ0FBQSxDQUFBO0NBRUEsQ0FBQSxDQUFBOztBQUVBLEdBQUEsQ0FBQSxVQUFBLENBQUEsWUFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLFdBQUEsRUFBQSxNQUFBLEVBQUE7O0FBRUEsVUFBQSxDQUFBLE1BQUEsR0FBQSxFQUFBLENBQUE7QUFDQSxVQUFBLENBQUEsS0FBQSxHQUFBLElBQUEsQ0FBQTs7QUFFQSxVQUFBLENBQUEsVUFBQSxHQUFBLFVBQUEsVUFBQSxFQUFBOztBQUVBLGNBQUEsQ0FBQSxLQUFBLEdBQUEsSUFBQSxDQUFBO0FBQ0EsZUFBQSxDQUFBLEdBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQTtBQUNBLG1CQUFBLENBQUEsTUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxZQUFBO0FBQ0Esa0JBQUEsQ0FBQSxFQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7U0FDQSxDQUFBLFNBQUEsQ0FBQSxZQUFBO0FBQ0Esa0JBQUEsQ0FBQSxLQUFBLEdBQUEsNEJBQUEsQ0FBQTtTQUNBLENBQUEsQ0FBQTtLQUVBLENBQUE7Q0FFQSxDQUFBLENBQUE7QUMzQkEsR0FBQSxDQUFBLE1BQUEsQ0FBQSxVQUFBLGNBQUEsRUFBQTs7QUFFQSxrQkFBQSxDQUFBLEtBQUEsQ0FBQSxhQUFBLEVBQUE7QUFDQSxXQUFBLEVBQUEscUJBQUE7QUFDQSxtQkFBQSxFQUFBLDBCQUFBO0FBQ0Esa0JBQUEsRUFBQSxnQkFBQTs7O0FBR0EsWUFBQSxFQUFBO0FBQ0Esd0JBQUEsRUFBQSxJQUFBO1NBQ0E7S0FDQSxDQUFBLENBQ0EsS0FBQSxDQUFBLHdCQUFBLEVBQUE7QUFDQSxXQUFBLEVBQUEsT0FBQTtBQUNBLG1CQUFBLEVBQUEsbUJBQUE7QUFDQSxrQkFBQSxFQUFBLGdCQUFBO0tBQ0EsQ0FBQSxDQUNBLEtBQUEsQ0FBQSxxQkFBQSxFQUFBO0FBQ0EsV0FBQSxFQUFBLFdBQUE7QUFDQSxtQkFBQSxFQUFBLHVCQUFBO0FBQ0Esa0JBQUEsRUFBQSxnQkFBQTtLQUNBLENBQUEsQ0FDQSxLQUFBLENBQUEsdUJBQUEsRUFBQTtBQUNBLFdBQUEsRUFBQSxZQUFBO0FBQ0EsbUJBQUEsRUFBQSx3QkFBQTtBQUNBLGtCQUFBLEVBQUEsZ0JBQUE7S0FDQSxDQUFBLENBQ0EsS0FBQSxDQUFBLHVCQUFBLEVBQUE7QUFDQSxXQUFBLEVBQUEsWUFBQTtBQUNBLG1CQUFBLEVBQUEsd0JBQUE7QUFDQSxrQkFBQSxFQUFBLGdCQUFBO0tBQ0EsQ0FBQSxDQUFBO0NBRUEsQ0FBQSxDQUFBOztBQ2hDQSxHQUFBLENBQUEsVUFBQSxDQUFBLGdCQUFBLEVBQUEsVUFBQSxNQUFBLEVBQUEsV0FBQSxFQUFBLFlBQUEsRUFBQSxVQUFBLEVBQUEsWUFBQSxFQUFBLE1BQUEsRUFBQTtBQUNBLFdBQUEsQ0FBQSxHQUFBLENBQUEsb0JBQUEsQ0FBQSxDQUFBO0FBQ0EsUUFBQSxXQUFBLEdBQUEsRUFBQSxDQUFBO0FBQ0EsVUFBQSxDQUFBLFVBQUEsR0FBQSxZQUFBO0FBQ0EsZUFBQSxXQUFBLENBQUEsZUFBQSxFQUFBLENBQUE7S0FDQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxRQUFBLEdBQUEsWUFBQTtBQUNBLGVBQUEsQ0FBQSxHQUFBLENBQUEsU0FBQSxDQUFBLENBQUE7QUFDQSxrQkFBQSxDQUFBLGNBQUEsRUFBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLFFBQUEsRUFBQTtBQUNBLGtCQUFBLENBQUEsV0FBQSxHQUFBLFFBQUEsQ0FBQTs7U0FFQSxDQUFBLENBQUE7S0FDQSxDQUFBO0FBQ0EsVUFBQSxDQUFBLFFBQUEsRUFBQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxRQUFBLEdBQUEsVUFBQSxPQUFBLEVBQUEsRUFFQSxDQUFBO0FBQ0EsUUFBQSxJQUFBLEdBQUEsS0FBQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsVUFBQSxLQUFBLEVBQUE7O0FBRUEsWUFBQSxJQUFBLEtBQUEsSUFBQSxFQUFBO0FBQ0Esa0JBQUEsQ0FBQSxNQUFBLENBQUEsSUFBQSxFQUFBLENBQUE7U0FDQTs7QUFFQSxvQkFBQSxDQUFBLFlBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLFVBQUEsTUFBQSxFQUFBO0FBQ0Esa0JBQUEsQ0FBQSxNQUFBLEdBQUEsTUFBQSxDQUFBO0FBQ0EsZ0JBQUEsSUFBQSxLQUFBLEtBQUEsRUFBQTtBQUNBLG9CQUFBLEdBQUEsSUFBQSxDQUFBO0FBQ0Esc0JBQUEsQ0FBQSxNQUFBLENBQUEsS0FBQSxFQUFBLENBQUE7YUFDQSxNQUNBO0FBQ0Esb0JBQUEsR0FBQSxLQUFBLENBQUE7YUFDQTtTQUNBLENBQUEsQ0FBQTtLQUNBLENBQUE7O0FBR0EsVUFBQSxDQUFBLGNBQUEsR0FBQSxVQUFBLElBQUEsRUFBQTtBQUNBLGVBQUEsQ0FBQSxHQUFBLENBQUEsU0FBQSxFQUFBLElBQUEsQ0FBQSxDQUFBO0FBQ0EsY0FBQSxDQUFBLEVBQUEsQ0FBQSxhQUFBLEVBQUEsRUFBQSxLQUFBLEVBQUEsSUFBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLENBQUE7S0FDQSxDQUFBO0NBS0EsQ0FBQSxDQUFBOztBQ2pEQSxHQUFBLENBQUEsVUFBQSxDQUFBLHNCQUFBLEVBQUEsVUFBQSxNQUFBLEVBQUEsV0FBQSxFQUFBLFVBQUEsRUFBQSxNQUFBLEVBQUE7QUFDQSxVQUFBLENBQUEsSUFBQSxDQUFBOztBQUVBLGVBQUEsQ0FBQSxlQUFBLEVBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxJQUFBLEVBQUE7QUFDQSxjQUFBLENBQUEsSUFBQSxHQUFBLElBQUEsQ0FBQTtBQUNBLGVBQUEsQ0FBQSxHQUFBLENBQUEsU0FBQSxFQUFBLE1BQUEsQ0FBQSxJQUFBLENBQUEsUUFBQSxDQUFBLENBQUE7S0FDQSxDQUFBLENBQUE7O0FBRUEsVUFBQSxDQUFBLGFBQUEsR0FBQSxZQUFBO0FBQ0Esa0JBQUEsQ0FBQSxVQUFBLENBQUEsTUFBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLFNBQUEsRUFBQTtBQUNBLG1CQUFBLENBQUEsR0FBQSxDQUFBLFlBQUEsRUFBQSxTQUFBLENBQUEsQ0FBQTtBQUNBLGtCQUFBLENBQUEsRUFBQSxDQUFBLFNBQUEsRUFBQSxFQUFBLFNBQUEsRUFBQSxTQUFBLEVBQUEsQ0FBQSxDQUFBO1NBQ0EsQ0FBQSxDQUFBO0tBRUEsQ0FBQTtDQUVBLENBQUEsQ0FBQTtBQ2hCQSxHQUFBLENBQUEsVUFBQSxDQUFBLG9CQUFBLEVBQUEsVUFBQSxNQUFBLEVBQUEsWUFBQSxFQUFBLGFBQUEsRUFBQSxXQUFBLEVBQUEsVUFBQSxFQUFBLFlBQUEsRUFBQSxlQUFBLEVBQUE7O0FBRUEsUUFBQSxRQUFBLEdBQUEsRUFBQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsRUFBQSxDQUFBO0FBQ0EsU0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLEVBQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtBQUNBLGNBQUEsQ0FBQSxXQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0tBQ0E7O0FBRUEsVUFBQSxDQUFBLGFBQUEsR0FBQSxDQUFBLENBQUE7QUFDQSxVQUFBLENBQUEsTUFBQSxHQUFBLEVBQUEsQ0FBQTtBQUNBLFVBQUEsQ0FBQSxPQUFBLEdBQUEsSUFBQSxDQUFBOztBQUdBLGNBQUEsQ0FBQSxjQUFBLENBQUEsMEJBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLE9BQUEsRUFBQTs7QUFFQSxZQUFBLE1BQUEsR0FBQSxDQUFBLENBQUE7QUFDQSxlQUFBLENBQUEsR0FBQSxDQUFBLFNBQUEsRUFBQSxPQUFBLENBQUEsQ0FBQTs7QUFFQSxZQUFBLE9BQUEsQ0FBQSxNQUFBLENBQUEsTUFBQSxFQUFBO0FBQ0EsbUJBQUEsQ0FBQSxNQUFBLENBQUEsT0FBQSxDQUFBLFVBQUEsS0FBQSxFQUFBO0FBQ0Esb0JBQUEsV0FBQSxHQUFBLFNBQUEsV0FBQSxHQUFBO0FBQ0EsMEJBQUEsRUFBQSxDQUFBO0FBQ0Esd0JBQUEsTUFBQSxLQUFBLE9BQUEsQ0FBQSxNQUFBLENBQUEsTUFBQSxFQUFBO0FBQ0EsOEJBQUEsQ0FBQSxPQUFBLEdBQUEsS0FBQSxDQUFBOztxQkFFQTtpQkFDQSxDQUFBO0FBQ0EscUJBQUEsQ0FBQSxNQUFBLEdBQUEsWUFBQSxDQUFBLFlBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLFdBQUEsQ0FBQSxDQUFBO0FBQ0EsK0JBQUEsQ0FBQSxpQkFBQSxDQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUEsS0FBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBO0FBQ0Esc0JBQUEsQ0FBQSxNQUFBLENBQUEsSUFBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBO2FBQ0EsQ0FBQSxDQUFBO1NBQ0EsTUFBQTtBQUNBLGlCQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxFQUFBO0FBQ0Esb0JBQUEsR0FBQSxHQUFBLEVBQUEsQ0FBQTtBQUNBLG1CQUFBLENBQUEsSUFBQSxHQUFBLFFBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUE7QUFDQSxtQkFBQSxDQUFBLFFBQUEsR0FBQSxFQUFBLENBQUE7QUFDQSxzQkFBQSxDQUFBLE1BQUEsQ0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLENBQUE7YUFDQTtTQUNBOztBQUVBLHVCQUFBLENBQUEsWUFBQSxDQUFBLE9BQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQTtBQUNBLHVCQUFBLENBQUEsU0FBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtLQUVBLENBQUEsQ0FBQTs7Ozs7Ozs7QUFRQSxVQUFBLENBQUEsTUFBQSxHQUFBLFVBQUEsQ0FBQSxFQUFBLEtBQUEsRUFBQTs7QUFFQSxTQUFBLEdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQTs7O0FBR0EsZUFBQSxDQUFBLEdBQUEsQ0FBQSxpQkFBQSxDQUFBLENBQUE7O0FBRUEsWUFBQSxDQUFBLGFBQUEsRUFDQSxPQUFBOztBQUVBLFNBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBO0FBQ0EscUJBQUEsQ0FBQSxLQUFBLEVBQUEsQ0FBQTtBQUNBLHFCQUFBLENBQUEsTUFBQSxFQUFBLENBQUE7O0FBRUEsY0FBQSxDQUFBLFVBQUEsQ0FBQSxZQUFBO0FBQ0EseUJBQUEsQ0FBQSxJQUFBLEVBQUEsQ0FBQTtBQUNBLGFBQUEsQ0FBQSxTQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBO0FBQ0EseUJBQUEsQ0FBQSxVQUFBLENBQUEsVUFBQSxDQUFBLENBQUE7O0FBRUEsa0JBQUEsQ0FBQSxVQUFBLENBQUEsWUFBQTtBQUNBLHNCQUFBLENBQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLFFBQUEsR0FBQSxNQUFBLENBQUEsZUFBQSxDQUFBOzthQUdBLEVBQUEsR0FBQSxDQUFBLENBQUE7U0FFQSxFQUFBLElBQUEsQ0FBQSxDQUFBO0tBRUEsQ0FBQTs7QUFFQSxVQUFBLENBQUEsUUFBQSxHQUFBLFlBQUEsRUFFQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxTQUFBLEdBQUEsWUFBQTs7QUFFQSxZQUFBLFNBQUEsR0FBQSxNQUFBLENBQUEsTUFBQSxDQUFBLE1BQUEsQ0FBQSxVQUFBLEtBQUEsRUFBQSxLQUFBLEVBQUE7QUFDQSxnQkFBQSxLQUFBLENBQUEsUUFBQSxFQUFBO0FBQ0EsdUJBQUEsSUFBQSxDQUFBO2FBQ0E7U0FDQSxDQUFBLENBQUE7QUFDQSxtQkFBQSxDQUFBLFNBQUEsQ0FBQSxTQUFBLEVBQUEsMEJBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLFFBQUEsRUFBQTs7QUFFQSxtQkFBQSxDQUFBLEdBQUEsQ0FBQSx5QkFBQSxFQUFBLFFBQUEsQ0FBQSxDQUFBO1NBRUEsQ0FBQSxDQUFBO0tBQ0EsQ0FBQTtDQU1BLENBQUEsQ0FBQTs7QUN0R0EsR0FBQSxDQUFBLFVBQUEsQ0FBQSxnQkFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLE1BQUEsRUFBQSxXQUFBLEVBQUEsWUFBQSxFQUFBLFdBQUEsRUFBQTs7QUFFQSxlQUFBLENBQUEsZUFBQSxFQUFBLENBQUEsSUFBQSxDQUFBLFVBQUEsWUFBQSxFQUFBO0FBQ0EsZUFBQSxDQUFBLEdBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQTs7QUFFQSxjQUFBLENBQUEsWUFBQSxHQUFBLFlBQUEsQ0FBQTs7QUFFQSxtQkFBQSxDQUFBLFVBQUEsQ0FBQSxZQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLFVBQUEsSUFBQSxFQUFBO0FBQ0Esa0JBQUEsQ0FBQSxJQUFBLEdBQUEsSUFBQSxDQUFBO0FBQ0EsbUJBQUEsQ0FBQSxHQUFBLENBQUEsU0FBQSxFQUFBLElBQUEsQ0FBQSxDQUFBO1NBQ0EsQ0FBQSxDQUFBO0tBR0EsQ0FBQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxlQUFBLEdBQUEsWUFBQTtBQUNBLFlBQUEsTUFBQSxDQUFBLFlBQUEsRUFBQSxNQUFBLENBQUEsWUFBQSxHQUFBLEtBQUEsQ0FBQSxLQUNBLE1BQUEsQ0FBQSxZQUFBLEdBQUEsSUFBQSxDQUFBO0FBQ0EsZUFBQSxDQUFBLEdBQUEsQ0FBQSxNQUFBLENBQUEsWUFBQSxDQUFBLENBQUE7S0FDQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxNQUFBLEdBQUEsVUFBQSxJQUFBLEVBQUE7QUFDQSxtQkFBQSxDQUFBLE1BQUEsQ0FBQSxJQUFBLEVBQUEsTUFBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLFFBQUEsRUFBQTtBQUNBLG1CQUFBLENBQUEsR0FBQSxDQUFBLDRCQUFBLEVBQUEsUUFBQSxDQUFBLENBQUE7U0FDQSxDQUFBLENBQUE7S0FDQSxDQUFBO0NBS0EsQ0FBQSxDQUFBO0FDL0JBLEdBQUEsQ0FBQSxPQUFBLENBQUEsYUFBQSxFQUFBLFlBQUE7O0FBRUEsUUFBQSxlQUFBLEdBQUEsU0FBQSxlQUFBLENBQUEsZUFBQSxFQUFBLFlBQUEsRUFBQSxjQUFBLEVBQUE7O0FBRUEsaUJBQUEsTUFBQSxHQUFBO0FBQ0EsZ0JBQUEsT0FBQSxHQUFBLENBQUEsQ0FBQTtBQUNBLGdCQUFBLFNBQUEsR0FBQSxDQUFBLENBQUE7QUFDQSxnQkFBQSxPQUFBLEdBQUEsSUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLEdBQUEsT0FBQSxDQUFBLENBQUE7QUFDQSxnQkFBQSxZQUFBLEdBQUEsSUFBQSxVQUFBLENBQUEsWUFBQSxDQUFBLGlCQUFBLENBQUEsQ0FBQTs7QUFFQSx3QkFBQSxDQUFBLG9CQUFBLENBQUEsWUFBQSxDQUFBLENBQUE7O0FBRUEsMkJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxHQUFBLEVBQUEsR0FBQSxDQUFBLENBQUE7QUFDQSwyQkFBQSxDQUFBLFNBQUEsR0FBQSxTQUFBLENBQUE7QUFDQSwyQkFBQSxDQUFBLE9BQUEsR0FBQSxPQUFBLENBQUE7QUFDQSxnQkFBQSxVQUFBLEdBQUEsWUFBQSxDQUFBLGlCQUFBLEdBQUEsT0FBQSxDQUFBOzs7QUFHQSxpQkFBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLE9BQUEsRUFBQSxFQUFBLENBQUEsRUFBQTtBQUNBLG9CQUFBLFNBQUEsR0FBQSxDQUFBLENBQUE7QUFDQSxvQkFBQSxNQUFBLEdBQUEsSUFBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLEdBQUEsVUFBQSxDQUFBLENBQUE7O0FBRUEscUJBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxVQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQ0EsU0FBQSxJQUFBLFlBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUE7QUFDQSx5QkFBQSxHQUFBLFNBQUEsR0FBQSxVQUFBLENBQUE7QUFDQSxvQkFBQSxVQUFBLEdBQUEsWUFBQSxDQUFBLENBQUEsR0FBQSxVQUFBLENBQUEsQ0FBQTtBQUNBLCtCQUFBLENBQUEsU0FBQSxHQUFBLE9BQUEsR0FBQSxJQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsT0FBQSxDQUFBLEdBQUEsY0FBQSxDQUFBO0FBQ0EsK0JBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxHQUFBLE9BQUEsRUFBQSxHQUFBLEVBQUEsU0FBQSxFQUFBLENBQUEsU0FBQSxDQUFBLENBQUE7YUFDQTtBQUNBLGdCQUFBLGNBQUEsRUFBQTtBQUNBLHNCQUFBLENBQUEscUJBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQTthQUNBO1NBQ0E7QUFDQSxjQUFBLENBQUEscUJBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQTtLQUNBLENBQUE7O0FBR0EsUUFBQSxxQkFBQSxHQUFBLFNBQUEscUJBQUEsQ0FBQSxVQUFBLEVBQUE7QUFDQSxjQUFBLENBQUEsb0JBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQTtLQUNBLENBQUE7QUFDQSxXQUFBO0FBQ0EsdUJBQUEsRUFBQSxlQUFBO0FBQ0EsNkJBQUEsRUFBQSxxQkFBQTtLQUNBLENBQUE7Q0FDQSxDQUFBLENBQUE7QUM1Q0EsWUFBQSxDQUFBO0FBQ0EsR0FBQSxDQUFBLE9BQUEsQ0FBQSxTQUFBLEVBQUEsVUFBQSxLQUFBLEVBQUE7O0FBR0EsV0FBQTtBQUNBLGVBQUEsRUFBQSxpQkFBQSxJQUFBLEVBQUE7QUFDQSxtQkFBQSxLQUFBLENBQUEsR0FBQSxDQUFBLFdBQUEsRUFBQSxFQUFBLE1BQUEsRUFBQSxFQUFBLEdBQUEsRUFBQSxJQUFBLEVBQUEsRUFBQSxDQUFBLENBQ0EsSUFBQSxDQUFBLFVBQUEsT0FBQSxFQUFBO0FBQ0EsdUJBQUEsT0FBQSxDQUFBLElBQUEsQ0FBQTthQUNBLENBQUEsQ0FBQTtTQUNBO0tBQ0EsQ0FBQTtDQUVBLENBQUEsQ0FBQTtBQ2JBLFlBQUEsQ0FBQTtBQUNBLEdBQUEsQ0FBQSxPQUFBLENBQUEsWUFBQSxFQUFBLFVBQUEsS0FBQSxFQUFBOztBQUVBLFFBQUEsY0FBQSxHQUFBLFNBQUEsY0FBQSxDQUFBLFNBQUEsRUFBQTs7O0FBR0EsWUFBQSxTQUFBLEdBQUEsU0FBQSxJQUFBLEtBQUEsQ0FBQTtBQUNBLGVBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQSxnQkFBQSxHQUFBLFNBQUEsSUFBQSxTQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxRQUFBLEVBQUE7QUFDQSxtQkFBQSxRQUFBLENBQUEsSUFBQSxDQUFBO1NBQ0EsQ0FBQSxDQUFBO0tBQ0EsQ0FBQTs7QUFFQSxRQUFBLFdBQUEsR0FBQSxTQUFBLFdBQUEsQ0FBQSxPQUFBLEVBQUE7QUFDQSxlQUFBLEtBQUEsQ0FBQSxJQUFBLENBQUEsZ0JBQUEsRUFBQSxPQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxJQUFBLEVBQUE7QUFDQSxtQkFBQSxLQUFBLENBQUEsR0FBQSxDQUFBLFlBQUEsRUFBQSxJQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsSUFBQSxDQUFBLFVBQUEsUUFBQSxFQUFBO0FBQ0EsdUJBQUEsUUFBQSxDQUFBLElBQUEsQ0FBQTthQUNBLENBQUEsQ0FBQTtTQUNBLENBQUEsQ0FBQTtLQUNBLENBQUE7QUFDQSxRQUFBLFVBQUEsR0FBQSxTQUFBLFVBQUEsQ0FBQSxJQUFBLEVBQUE7QUFDQSxlQUFBLEtBQUEsQ0FBQSxJQUFBLENBQUEsZUFBQSxFQUFBLEVBQUEsS0FBQSxFQUFBLElBQUEsQ0FBQSxHQUFBLEVBQUEsSUFBQSxFQUFBLFVBQUEsRUFBQSxHQUFBLEVBQUEsR0FBQSxFQUFBLFVBQUEsRUFBQSxFQUFBLEVBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLFFBQUEsRUFBQTtBQUNBLG1CQUFBLFFBQUEsQ0FBQSxJQUFBLENBQUE7U0FDQSxDQUFBLENBQUE7S0FDQSxDQUFBOztBQUVBLFdBQUE7QUFDQSxzQkFBQSxFQUFBLGNBQUE7QUFDQSxtQkFBQSxFQUFBLFdBQUE7QUFDQSxrQkFBQSxFQUFBLFVBQUE7S0FDQSxDQUFBO0NBRUEsQ0FBQSxDQUFBOztBQy9CQSxZQUFBLENBQUE7QUFDQSxHQUFBLENBQUEsT0FBQSxDQUFBLGlCQUFBLEVBQUEsWUFBQTs7QUFFQSxRQUFBLGtCQUFBLEdBQUEsU0FBQSxrQkFBQSxDQUFBLEdBQUEsRUFBQTtBQUNBLGVBQUEsR0FBQSxDQUFBLElBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxDQUFBLE1BQUEsRUFBQSxHQUFBLEdBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBO0tBQ0EsQ0FBQTs7QUFFQSxRQUFBLFNBQUEsR0FBQSxDQUNBLGVBQUEsRUFDQSx1QkFBQSxFQUNBLHNCQUFBLEVBQ0EsdUJBQUEsRUFDQSx5REFBQSxFQUNBLDBDQUFBLEVBQ0EsY0FBQSxFQUNBLHVCQUFBLEVBQ0EsSUFBQSxDQUNBLENBQUE7O0FBRUEsV0FBQTtBQUNBLGlCQUFBLEVBQUEsU0FBQTtBQUNBLHlCQUFBLEVBQUEsNkJBQUE7QUFDQSxtQkFBQSxrQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBO1NBQ0E7S0FDQSxDQUFBO0NBRUEsQ0FBQSxDQUFBOztBQzFCQSxHQUFBLENBQUEsT0FBQSxDQUFBLGFBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQSxXQUFBLEVBQUEsRUFBQSxFQUFBLFlBQUEsRUFBQSxXQUFBLEVBQUE7O0FBRUEsUUFBQSxZQUFBLEdBQUEsU0FBQSxZQUFBLEdBQUE7O0FBRUEsZUFBQSxFQUFBLENBQUEsVUFBQSxPQUFBLEVBQUEsTUFBQSxFQUFBO0FBQ0EsZ0JBQUEsT0FBQSxHQUFBLE1BQUEsQ0FBQSxZQUFBLElBQUEsTUFBQSxDQUFBLGtCQUFBLENBQUE7QUFDQSxnQkFBQSxZQUFBLEdBQUEsSUFBQSxPQUFBLEVBQUEsQ0FBQTtBQUNBLGdCQUFBLFFBQUEsQ0FBQTs7QUFFQSxnQkFBQSxTQUFBLEdBQUEsTUFBQSxDQUFBLFNBQUEsQ0FBQTtBQUNBLHFCQUFBLENBQUEsWUFBQSxHQUNBLFNBQUEsQ0FBQSxZQUFBLElBQ0EsU0FBQSxDQUFBLGtCQUFBLElBQ0EsU0FBQSxDQUFBLGVBQUEsSUFDQSxTQUFBLENBQUEsY0FBQSxBQUNBLENBQUE7QUFDQSxnQkFBQSxDQUFBLFNBQUEsQ0FBQSxvQkFBQSxFQUNBLFNBQUEsQ0FBQSxvQkFBQSxHQUFBLFNBQUEsQ0FBQSwwQkFBQSxJQUFBLFNBQUEsQ0FBQSx1QkFBQSxDQUFBO0FBQ0EsZ0JBQUEsQ0FBQSxTQUFBLENBQUEscUJBQUEsRUFDQSxTQUFBLENBQUEscUJBQUEsR0FBQSxTQUFBLENBQUEsMkJBQUEsSUFBQSxTQUFBLENBQUEsd0JBQUEsQ0FBQTs7O0FBR0EscUJBQUEsQ0FBQSxZQUFBLENBQ0E7QUFDQSx1QkFBQSxFQUFBO0FBQ0EsK0JBQUEsRUFBQTtBQUNBLDhDQUFBLEVBQUEsT0FBQTtBQUNBLDZDQUFBLEVBQUEsT0FBQTtBQUNBLDhDQUFBLEVBQUEsT0FBQTtBQUNBLDRDQUFBLEVBQUEsT0FBQTtxQkFDQTtBQUNBLDhCQUFBLEVBQUEsRUFBQTtpQkFDQTthQUNBLEVBQUEsVUFBQSxNQUFBLEVBQUE7QUFDQSxvQkFBQSxVQUFBLEdBQUEsWUFBQSxDQUFBLFVBQUEsRUFBQSxDQUFBOzs7QUFHQSxvQkFBQSxjQUFBLEdBQUEsWUFBQSxDQUFBLHVCQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7QUFDQSxvQkFBQSxVQUFBLEdBQUEsY0FBQSxDQUFBO0FBQ0EsMEJBQUEsQ0FBQSxPQUFBLENBQUEsVUFBQSxDQUFBLENBQUE7OztBQUdBLG9CQUFBLFlBQUEsR0FBQSxZQUFBLENBQUEsY0FBQSxFQUFBLENBQUE7QUFDQSw0QkFBQSxDQUFBLE9BQUEsR0FBQSxJQUFBLENBQUE7QUFDQSwwQkFBQSxDQUFBLE9BQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQTs7O0FBR0Esd0JBQUEsR0FBQSxJQUFBLFFBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQTtBQUNBLG9CQUFBLFFBQUEsR0FBQSxZQUFBLENBQUEsVUFBQSxFQUFBLENBQUE7QUFDQSx3QkFBQSxDQUFBLElBQUEsQ0FBQSxLQUFBLEdBQUEsR0FBQSxDQUFBO0FBQ0EsMEJBQUEsQ0FBQSxPQUFBLENBQUEsUUFBQSxDQUFBLENBQUE7QUFDQSx3QkFBQSxDQUFBLE9BQUEsQ0FBQSxZQUFBLENBQUEsV0FBQSxDQUFBLENBQUE7O0FBRUEsdUJBQUEsQ0FBQSxDQUFBLFFBQUEsRUFBQSxZQUFBLENBQUEsQ0FBQSxDQUFBO2FBRUEsRUFBQSxVQUFBLENBQUEsRUFBQTtBQUNBLHFCQUFBLENBQUEscUJBQUEsQ0FBQSxDQUFBOztBQUVBLHNCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7YUFDQSxDQUFBLENBQUE7U0FDQSxDQUFBLENBQUE7S0FDQSxDQUFBOztBQUVBLFFBQUEsV0FBQSxHQUFBLFNBQUEsV0FBQSxDQUFBLFFBQUEsRUFBQTtBQUNBLGdCQUFBLENBQUEsS0FBQSxFQUFBLENBQUE7QUFDQSxnQkFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBO0tBQ0EsQ0FBQTs7QUFFQSxRQUFBLFVBQUEsR0FBQSxTQUFBLFVBQUEsQ0FBQSxLQUFBLEVBQUEsUUFBQSxFQUFBO0FBQ0EsZ0JBQUEsQ0FBQSxJQUFBLEVBQUEsQ0FBQTtBQUNBLGVBQUEsSUFBQSxFQUFBLENBQUEsVUFBQSxPQUFBLEVBQUEsTUFBQSxFQUFBOztBQUVBLG9CQUFBLENBQUEsVUFBQSxDQUFBLFVBQUEsT0FBQSxFQUFBOztBQUVBLG9CQUFBLE1BQUEsR0FBQSxRQUFBLENBQUEsY0FBQSxDQUFBLGFBQUEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUNBLDBCQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsRUFBQSxNQUFBLENBQUEsVUFBQSxDQUFBLElBQUEsQ0FBQSxFQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0FBQ0Esc0JBQUEsQ0FBQSxZQUFBLEdBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0FBQ0Esc0JBQUEsQ0FBQSxvQkFBQSxHQUFBLE1BQUEsQ0FBQSxTQUFBLENBQUEsV0FBQSxDQUFBLENBQUE7Ozs7QUFJQSx3QkFBQSxDQUFBLFNBQUEsQ0FBQSxVQUFBLElBQUEsRUFBQTs7OztBQUlBLGdDQUFBLENB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O0FBRUEsMkJBQUEsRUFBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLFNBQUEsRUFBQTtBQUNBLG9CQUFBLENBQUEsU0FBQSxDQUFBLFdBQUEsQ0FBQSxZQUFBO0FBQ0Esd0JBQUEsTUFBQSxHQUFBLElBQUEsQ0FBQSxTQUFBLENBQUEsUUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtBQUNBLHdCQUFBLE9BQUEsR0FBQSxDQUFBLFFBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsUUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxHQUFBLENBQUEsQ0FBQSxRQUFBLEVBQUEsR0FBQSxJQUFBLENBQUE7QUFDQSw0QkFBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLEdBQUEsT0FBQSxDQUFBO0FBQ0EsNkJBQUEsQ0FBQSxLQUFBLEVBQUEsQ0FBQTtpQkFDQSxFQUFBLElBQUEsQ0FBQSxDQUFBO0FBQ0Esb0JBQUEsQ0FBQSxTQUFBLENBQUEsV0FBQSxDQUFBLFlBQUE7QUFDQSwyQkFBQSxDQUFBLEdBQUEsQ0FBQSxJQUFBLENBQUEsU0FBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBO0FBQ0EsNkJBQUEsQ0FBQSxLQUFBLEVBQUEsQ0FBQTtpQkFDQSxFQUFBLElBQUEsQ0FBQSxDQUFBO0FBQ0EsdUJBQUEsT0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBO2FBQ0EsQ0FBQSxDQUFBO1NBQ0EsQ0FBQSxDQUFBO0tBQ0EsQ0FBQTs7QUFFQSxRQUFBLFNBQUEsR0FBQSxTQUFBLFNBQUEsQ0FBQSxHQUFBLEVBQUE7QUFDQSxZQUFBLENBQUEsU0FBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLEdBQUEsR0FBQSxDQUFBO0FBQ0EsZUFBQSxJQUFBLENBQUEsU0FBQSxDQUFBO0tBQ0EsQ0FBQTs7QUFFQSxRQUFBLE9BQUEsR0FBQSxTQUFBLE9BQUEsQ0FBQSxNQUFBLEVBQUE7QUFDQSxjQUFBLENBQUEsT0FBQSxDQUFBLFVBQUEsS0FBQSxFQUFBO0FBQ0EsZ0JBQUEsS0FBQSxDQUFBLE1BQUEsRUFBQSxLQUFBLENBQUEsTUFBQSxDQUFBLElBQUEsRUFBQSxDQUFBO1NBQ0EsQ0FBQSxDQUFBO0tBQ0EsQ0FBQTs7QUFFQSxRQUFBLE9BQUEsR0FBQSxTQUFBLE9BQUEsQ0FBQSxNQUFBLEVBQUE7QUFDQSxjQUFBLENBQUEsT0FBQSxDQUFBLFVBQUEsS0FBQSxFQUFBO0FBQ0EsZ0JBQUEsS0FBQSxDQUFBLE1BQUEsRUFBQSxLQUFBLENBQUEsTUFBQSxDQUFBLE1BQUEsQ0FBQSxLQUFBLEdBQUEsQ0FBQSxHQUFBLENBQUE7U0FDQSxDQUFBLENBQUE7S0FDQSxDQUFBOztBQUVBLFFBQUEsU0FBQSxHQUFBLFNBQUEsU0FBQSxDQUFBLE1BQUEsRUFBQTtBQUNBLGNBQUEsQ0FBQSxPQUFBLENBQUEsVUFBQSxLQUFBLEVBQUE7QUFDQSxnQkFBQSxLQUFBLENBQUEsTUFBQSxFQUFBLEtBQUEsQ0FBQSxNQUFBLENBQUEsTUFBQSxDQUFBLEtBQUEsR0FBQSxDQUFBLENBQUE7U0FDQSxDQUFBLENBQUE7S0FDQSxDQUFBOztBQUVBLFFBQUEsZUFBQSxHQUFBLFNBQUEsZUFBQSxHQUFBO0FBQ0EsZUFBQSxJQUFBLEVBQUEsQ0FBQSxVQUFBLE9BQUEsRUFBQSxNQUFBLEVBQUE7QUFDQSxnQkFBQSxHQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsTUFBQSxDQUFBLHFCQUFBLEVBQUEsWUFBQTtBQUNBLHVCQUFBLE9BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTthQUNBLENBQUEsQ0FBQSxRQUFBLEVBQUEsQ0FBQTtTQUNBLENBQUEsQ0FBQTtLQUNBLENBQUE7O0FBRUEsUUFBQSxpQkFBQSxHQUFBLFNBQUEsaUJBQUEsQ0FBQSxNQUFBLEVBQUEsY0FBQSxFQUFBOztBQUVBLFlBQUEsY0FBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsRUFBQTtBQUNBLGdCQUFBLENBQUEsU0FBQSxDQUFBLFdBQUEsQ0FBQSxZQUFBO0FBQ0Esc0JBQUEsQ0FBQSxJQUFBLEVBQUEsQ0FBQTthQUNBLEVBQUEsSUFBQSxDQUFBLENBQUE7U0FFQTs7QUFFQSxzQkFBQSxDQUFBLE9BQUEsQ0FBQSxVQUFBLFNBQUEsRUFBQTs7QUFFQSxnQkFBQSxTQUFBLEdBQUEsU0FBQSxDQUFBLFFBQUEsRUFBQSxHQUFBLEdBQUEsQ0FBQTs7QUFFQSxnQkFBQSxDQUFBLFNBQUEsQ0FBQSxXQUFBLENBQUEsWUFBQTtBQUNBLHVCQUFBLENBQUEsR0FBQSxDQUFBLE9BQUEsRUFBQSxJQUFBLENBQUEsU0FBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBO0FBQ0Esc0JBQUEsQ0FBQSxJQUFBLEVBQUEsQ0FBQTtBQUNBLHNCQUFBLENBQUEsS0FBQSxFQUFBLENBQUE7YUFDQSxFQUFBLFNBQUEsQ0FBQSxDQUFBOzs7Ozs7O1NBUUEsQ0FBQSxDQUFBO0tBRUEsQ0FBQTs7QUFFQSxXQUFBO0FBQ0EsdUJBQUEsRUFBQSxlQUFBO0FBQ0EsaUJBQUEsRUFBQSxTQUFBO0FBQ0EseUJBQUEsRUFBQSxpQkFBQTtBQUNBLHVCQUFBLEVBQUEsZUFBQTtBQUNBLGVBQUEsRUFBQSxPQUFBO0FBQ0EsZUFBQSxFQUFBLE9BQUE7QUFDQSxpQkFBQSxFQUFBLFNBQUE7S0FDQSxDQUFBO0NBRUEsQ0FBQSxDQUFBOztBQ2hHQSxZQUFBLENBQUE7QUFDQSxHQUFBLENBQUEsT0FBQSxDQUFBLGNBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQSxFQUFBLEVBQUE7O0FBRUEsUUFBQSxZQUFBLEdBQUEsU0FBQSxZQUFBLENBQUEsR0FBQSxFQUFBLE1BQUEsRUFBQTtBQUNBLFlBQUEsTUFBQSxHQUFBLElBQUEsSUFBQSxDQUFBLE1BQUEsQ0FBQSxHQUFBLEVBQUEsTUFBQSxDQUFBLENBQUE7O0FBRUEsY0FBQSxDQUFBLFFBQUEsRUFBQSxDQUFBOzs7QUFHQSxlQUFBLE1BQUEsQ0FBQTtLQUNBLENBQUE7O0FBRUEsUUFBQSxjQUFBLEdBQUEsU0FBQSxjQUFBLENBQUEsSUFBQSxFQUFBLEtBQUEsRUFBQSxRQUFBLEVBQUE7QUFDQSxlQUFBLElBQUEsRUFBQSxDQUFBLFVBQUEsT0FBQSxFQUFBLE1BQUEsRUFBQTs7QUFFQSxnQkFBQSxHQUFBLEdBQUEsQ0FBQSxNQUFBLENBQUEsR0FBQSxJQUFBLE1BQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxlQUFBLENBQUEsSUFBQSxDQUFBLENBQUE7QUFDQSxnQkFBQSxJQUFBLEdBQUEsUUFBQSxDQUFBLGNBQUEsQ0FBQSxNQUFBLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFDQSxnQkFBQSxDQUFBLElBQUEsR0FBQSxHQUFBLENBQUE7QUFDQSxnQkFBQSxDQUFBLFFBQUEsR0FBQSxRQUFBLElBQUEsUUFBQSxHQUFBLEtBQUEsR0FBQSxNQUFBLENBQUE7QUFDQSxrQkFBQSxDQUFBLGVBQUEsR0FBQSxJQUFBLENBQUE7QUFDQSxrQkFBQSxDQUFBLGtCQUFBLEdBQUEsR0FBQSxDQUFBO0FBQ0EsZ0JBQUEsTUFBQSxDQUFBOztBQUVBLGtCQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsTUFBQSxDQUFBLElBQUEsQ0FBQSxJQUFBLEVBQUEsWUFBQTtBQUNBLHVCQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7YUFDQSxDQUFBLENBQUE7U0FDQSxDQUFBLENBQUE7S0FDQSxDQUFBOztBQUVBLFFBQUEsaUJBQUEsR0FBQSxTQUFBLGlCQUFBLEdBQUE7QUFDQSxZQUFBLE1BQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQTtBQUNBLFlBQUEsTUFBQSxHQUFBLElBQUEsSUFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBO0FBQ0EsWUFBQSxPQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsVUFBQSxFQUFBLENBQUE7QUFDQSxZQUFBLFFBQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxhQUFBLEVBQUEsQ0FBQTtBQUNBLGNBQUEsQ0FBQSxHQUFBLENBQUEsS0FBQSxHQUFBLENBQUEsQ0FBQTtBQUNBLGNBQUEsQ0FBQSxHQUFBLENBQUEsS0FBQSxHQUFBLENBQUEsQ0FBQTtBQUNBLGVBQUEsQ0FBQSxHQUFBLENBQUEsS0FBQSxHQUFBLENBQUEsQ0FBQTtBQUNBLGdCQUFBLENBQUEsR0FBQSxDQUFBLEtBQUEsR0FBQSxDQUFBLENBQUE7QUFDQSxjQUFBLENBQUEsT0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBO0FBQ0EsY0FBQSxDQUFBLE9BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQTtBQUNBLGVBQUEsQ0FBQSxPQUFBLENBQUEsUUFBQSxDQUFBLENBQUE7QUFDQSxnQkFBQSxDQUFBLFFBQUEsRUFBQSxDQUFBOztBQUVBLGVBQUEsQ0FBQSxNQUFBLEVBQUEsTUFBQSxFQUFBLE9BQUEsRUFBQSxRQUFBLENBQUEsQ0FBQTtLQUNBLENBQUE7O0FBRUEsUUFBQSw0QkFBQSxHQUFBLFNBQUEsNEJBQUEsQ0FBQSxNQUFBLEVBQUEsT0FBQSxFQUFBO0FBQ0EsZUFBQSxJQUFBLENBQUEsU0FBQSxDQUFBLFdBQUEsQ0FBQSxZQUFBO0FBQ0Esa0JBQUEsQ0FBQSxJQUFBLEVBQUEsQ0FBQTtBQUNBLGtCQUFBLENBQUEsS0FBQSxFQUFBLENBQUE7U0FDQSxFQUFBLE9BQUEsR0FBQSxHQUFBLENBQUEsQ0FBQTtLQUNBLENBQUE7O0FBRUEsUUFBQSxtQkFBQSxHQUFBLFNBQUEsbUJBQUEsQ0FBQSxNQUFBLEVBQUEsYUFBQSxFQUFBLFVBQUEsRUFBQTtBQUNBLGVBQUEsSUFBQSxFQUFBLENBQUEsVUFBQSxPQUFBLEVBQUEsTUFBQSxFQUFBO0FBQ0EsbUJBQUEsQ0FBQSxHQUFBLENBQUEsaUJBQUEsRUFBQSxhQUFBLENBQUEsQ0FBQTtBQUNBLGdCQUFBLENBQUEsU0FBQSxDQUFBLGFBQUEsQ0FBQSxRQUFBLENBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQTs7QUFFQSxtQkFBQSxDQUFBLDRCQUFBLENBQUEsTUFBQSxFQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUE7U0FDQSxDQUFBLENBQUE7S0FDQSxDQUFBO0FBQ0EsUUFBQSxrQkFBQSxHQUFBLFNBQUEsa0JBQUEsQ0FBQSxVQUFBLEVBQUE7QUFDQSxZQUFBLENBQUEsU0FBQSxDQUFBLGFBQUEsQ0FBQSxRQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsQ0FBQTtLQUNBLENBQUE7O0FBRUEsV0FBQTtBQUNBLG9CQUFBLEVBQUEsWUFBQTtBQUNBLHNCQUFBLEVBQUEsY0FBQTtBQUNBLHlCQUFBLEVBQUEsaUJBQUE7QUFDQSxvQ0FBQSxFQUFBLDRCQUFBO0FBQ0EsMkJBQUEsRUFBQSxtQkFBQTtBQUNBLDBCQUFBLEVBQUEsa0JBQUE7S0FDQSxDQUFBO0NBRUEsQ0FBQSxDQUFBOztBQzFFQSxHQUFBLENBQUEsT0FBQSxDQUFBLGFBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQTtBQUNBLFdBQUE7QUFDQSxrQkFBQSxFQUFBLG9CQUFBLE1BQUEsRUFBQTtBQUNBLG1CQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUEsV0FBQSxFQUFBLEVBQUEsTUFBQSxFQUFBLEVBQUEsR0FBQSxFQUFBLE1BQUEsRUFBQSxFQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxRQUFBLEVBQUE7QUFDQSx1QkFBQSxDQUFBLEdBQUEsQ0FBQSxhQUFBLEVBQUEsUUFBQSxDQUFBLElBQUEsQ0FBQSxDQUFBO0FBQ0EsdUJBQUEsUUFBQSxDQUFBLElBQUEsQ0FBQTthQUNBLENBQUEsQ0FBQTtTQUNBO0FBQ0EsY0FBQSxFQUFBLGdCQUFBLElBQUEsRUFBQSxZQUFBLEVBQUE7QUFDQSxtQkFBQSxLQUFBLENBQUEsR0FBQSxDQUFBLFdBQUEsRUFBQSxFQUFBLFlBQUEsRUFBQSxJQUFBLEVBQUEsWUFBQSxFQUFBLFlBQUEsRUFBQSxDQUFBLENBQUEsSUFBQSxDQUFBLFVBQUEsUUFBQSxFQUFBO0FBQ0EsdUJBQUEsQ0FBQSxHQUFBLENBQUEsNkJBQUEsRUFBQSxRQUFBLENBQUEsSUFBQSxDQUFBLENBQUE7QUFDQSx1QkFBQSxRQUFBLENBQUEsSUFBQSxDQUFBO2FBQ0EsQ0FBQSxDQUFBO1NBQ0E7S0FDQSxDQUFBO0NBRUEsQ0FBQSxDQUFBO0FDaEJBLEdBQUEsQ0FBQSxTQUFBLENBQUEsV0FBQSxFQUFBLFlBQUE7QUFDQSxXQUFBLFVBQUEsS0FBQSxFQUFBLE9BQUEsRUFBQSxLQUFBLEVBQUE7O0FBRUEsWUFBQSxFQUFBLEdBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxTQUFBLEdBQUEsSUFBQSxDQUFBOztBQUVBLFVBQUEsQ0FBQSxnQkFBQSxDQUFBLFdBQUEsRUFBQSxVQUFBLENBQUEsRUFBQTs7QUFFQSxhQUFBLENBQUEsWUFBQSxDQUFBLGFBQUEsR0FBQSxNQUFBLENBQUE7QUFDQSxhQUFBLENBQUEsWUFBQSxDQUFBLE9BQUEsQ0FBQSxNQUFBLEVBQUEsSUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBO0FBQ0EsZ0JBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBOztBQUVBLGdCQUFBLEdBQUEsR0FBQSxLQUFBLENBQUEsS0FBQSxDQUFBLFFBQUEsQ0FBQSxPQUFBLENBQUEsUUFBQSxDQUFBLEtBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBO0FBQ0EsaUJBQUEsQ0FBQSxLQUFBLENBQUEsUUFBQSxDQUFBLE1BQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUE7O0FBRUEsbUJBQUEsS0FBQSxDQUFBO1NBQ0EsRUFDQSxLQUFBLENBQ0EsQ0FBQTs7QUFFQSxVQUFBLENBQUEsZ0JBQUEsQ0FBQSxTQUFBLEVBQUEsVUFBQSxDQUFBLEVBQUE7QUFDQSxnQkFBQSxDQUFBLFNBQUEsQ0FBQSxNQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7QUFDQSxtQkFBQSxLQUFBLENBQUE7U0FDQSxFQUNBLEtBQUEsQ0FDQSxDQUFBO0tBRUEsQ0FBQTtDQUNBLENBQUEsQ0FBQTs7QUFFQSxHQUFBLENBQUEsU0FBQSxDQUFBLFdBQUEsRUFBQSxZQUFBO0FBQ0EsV0FBQTtBQUNBLGFBQUEsRUFBQTtBQUNBLGdCQUFBLEVBQUEsR0FBQTtBQUFBLFNBQ0E7QUFDQSxZQUFBLEVBQUEsY0FBQSxLQUFBLEVBQUEsT0FBQSxFQUFBOztBQUVBLGdCQUFBLEVBQUEsR0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7O0FBRUEsY0FBQSxDQUFBLGdCQUFBLENBQUEsVUFBQSxFQUFBLFVBQUEsQ0FBQSxFQUFBO0FBQ0EsaUJBQUEsQ0FBQSxZQUFBLENBQUEsVUFBQSxHQUFBLE1BQUEsQ0FBQTs7QUFFQSxvQkFBQSxDQUFBLENBQUEsY0FBQSxFQUFBLENBQUEsQ0FBQSxjQUFBLEVBQUEsQ0FBQTtBQUNBLG9CQUFBLENBQUEsU0FBQSxDQUFBLEdBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQTtBQUNBLHVCQUFBLEtBQUEsQ0FBQTthQUNBLEVBQ0EsS0FBQSxDQUNBLENBQUE7O0FBRUEsY0FBQSxDQUFBLGdCQUFBLENBQUEsV0FBQSxFQUFBLFVBQUEsQ0FBQSxFQUFBO0FBQ0Esb0JBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBO0FBQ0EsdUJBQUEsS0FBQSxDQUFBO2FBQ0EsRUFDQSxLQUFBLENBQ0EsQ0FBQTs7QUFFQSxjQUFBLENBQUEsZ0JBQUEsQ0FBQSxXQUFBLEVBQUEsVUFBQSxDQUFBLEVBQUE7QUFDQSxvQkFBQSxDQUFBLFNBQUEsQ0FBQSxNQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7QUFDQSx1QkFBQSxLQUFBLENBQUE7YUFDQSxFQUNBLEtBQUEsQ0FDQSxDQUFBOztBQUVBLGNBQUEsQ0FBQSxnQkFBQSxDQUFBLE1BQUEsRUFBQSxVQUFBLENBQUEsRUFBQTs7QUFFQSxvQkFBQSxDQUFBLENBQUEsZUFBQSxFQUFBLENBQUEsQ0FBQSxlQUFBLEVBQUEsQ0FBQTs7QUFFQSxvQkFBQSxDQUFBLFNBQUEsQ0FBQSxNQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7OztBQUdBLG9CQUFBLElBQUEsR0FBQSxRQUFBLENBQUEsY0FBQSxDQUFBLENBQUEsQ0FBQSxZQUFBLENBQUEsT0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUE7QUFDQSxvQkFBQSxTQUFBLEdBQUEsUUFBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLENBQUEsU0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQ0Esb0JBQUEsVUFBQSxHQUFBLElBQUEsQ0FBQSxVQUFBLENBQUE7QUFDQSxvQkFBQSxhQUFBLENBQUE7QUFDQSxvQkFBQSxTQUFBLENBQUE7O0FBRUEscUJBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxVQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO0FBQ0Esd0JBQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLFNBQUEsS0FBQSxZQUFBLEVBQUE7O0FBRUEsNEJBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsV0FBQSxDQUFBLElBQUEsQ0FBQSxDQUFBO0FBQ0EsNkJBQUEsQ0FBQSxPQUFBLENBQUEsT0FBQSxDQUFBLEtBQUEsQ0FBQSxRQUFBLENBQUEsSUFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBO0FBQ0EsNkJBQUEsQ0FBQSxPQUFBLENBQUEsT0FBQSxDQUFBLEtBQUEsQ0FBQSxRQUFBLENBQUEsSUFBQSxFQUFBLENBQUE7O0FBRUEsNEJBQUEsVUFBQSxHQUFBLElBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsVUFBQSxDQUFBOztBQUVBLDZCQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsVUFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTs7QUFFQSxnQ0FBQSxVQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsUUFBQSxLQUFBLFFBQUEsRUFBQTtBQUNBLDBDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsVUFBQSxDQUFBLFFBQUEsQ0FBQSxLQUFBLEdBQUEsU0FBQSxDQUFBO0FBQ0EsNkNBQUEsR0FBQSxVQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsVUFBQSxDQUFBLFVBQUEsQ0FBQSxLQUFBLENBQUE7QUFDQSx5Q0FBQSxHQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTs2QkFFQTt5QkFDQTtxQkFDQTtpQkFDQTs7QUFHQSxxQkFBQSxDQUFBLE9BQUEsQ0FBQSxPQUFBLENBQUEsY0FBQSxDQUFBLGFBQUEsRUFBQSxTQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxhQUFB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LHNCQUFBLENBQUEsR0FBQSxDQUFBLFdBQUEsQ0FBQSxhQUFBLEVBQUEsU0FBQSxDQUFBLENBQUE7QUFDQSxzQkFBQSxDQUFBLEdBQUEsQ0FBQSxXQUFBLENBQUEsY0FBQSxFQUFBLFVBQUEsQ0FBQSxDQUFBO1NBRUE7O0tBRUEsQ0FBQTtDQUVBLENBQUEsQ0FBQTtBQzVEQSxZQUFBLENBQUE7QUFDQSxHQUFBLENBQUEsU0FBQSxDQUFBLGVBQUEsRUFBQSxVQUFBLGVBQUEsRUFBQTs7QUFFQSxXQUFBO0FBQ0EsZ0JBQUEsRUFBQSxHQUFBO0FBQ0EsbUJBQUEsRUFBQSx5REFBQTtBQUNBLFlBQUEsRUFBQSxjQUFBLEtBQUEsRUFBQTtBQUNBLGlCQUFBLENBQUEsUUFBQSxHQUFBLGVBQUEsQ0FBQSxpQkFBQSxFQUFBLENBQUE7U0FDQTtLQUNBLENBQUE7Q0FFQSxDQUFBLENBQUE7QUNYQSxHQUFBLENBQUEsU0FBQSxDQUFBLFVBQUEsRUFBQSxVQUFBLFVBQUEsRUFBQSxZQUFBLEVBQUEsUUFBQSxFQUFBLFdBQUEsRUFBQSxVQUFBLEVBQUEsWUFBQSxFQUFBLGVBQUEsRUFBQSxXQUFBLEVBQUEsRUFBQSxFQUFBO0FBQ0EsV0FBQTtBQUNBLGdCQUFBLEVBQUEsR0FBQTtBQUNBLG1CQUFBLEVBQUEsdUNBQUE7QUFDQSxZQUFBLEVBQUEsY0FBQSxLQUFBLEVBQUEsT0FBQSxFQUFBLEtBQUEsRUFBQTtBQUNBLGlCQUFBLENBQUEsZUFBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUE7QUFDQSxzQkFBQSxDQUFBLFlBQUE7QUFDQSxvQkFBQSxTQUFBLEdBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLHNCQUFBLENBQUEsWUFBQSxDQUFBLENBQUE7O0FBRUEscUJBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxTQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBOztBQUVBLHdCQUFBLGFBQUEsR0FBQSxTQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsVUFBQSxDQUFBLFNBQUEsQ0FBQTs7QUFFQSx5QkFBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLGFBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7QUFDQSw0QkFBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLEtBQUEsT0FBQSxFQUFBO0FBQ0EsbUNBQUEsQ0FBQSxPQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSx5SEFBQSxDQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQTt5QkFDQTtxQkFDQTtpQkFDQTthQUNBLEVBQUEsQ0FBQSxDQUFBLENBQUE7O0FBRUEsaUJBQUEsQ0FBQSxjQUFBLEdBQUEsVUFBQSxLQUFBLEVBQUE7O0FBRUEscUJBQUEsQ0FBQSxLQUFBLENBQUEsTUFBQSxDQUFBLElBQUEsR0FBQSxLQUFBLENBQUE7QUFDQSxxQkFBQSxDQUFBLEtBQUEsQ0FBQSxNQUFBLENBQUEsSUFBQSxFQUFBLENBQUE7QUFDQSxxQkFBQSxDQUFBLEtBQUEsQ0FBQSxVQUFBLEdBQUEsSUFBQSxDQUFBO0FBQ0Esb0JBQUEsUUFBQSxHQUFBLENBQUEsQ0FBQTtBQUNBLG9CQUFBLFNBQUEsR0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsc0JBQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQTs7QUFFQSxvQkFBQSxLQUFBLENBQUEsS0FBQSxDQUFBLFFBQUEsQ0FBQSxNQUFBLEVBQUE7O0FBRUEsMkJBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxRQUFBLENBQUEsT0FBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBO0FBQ0EsZ0NBQUEsRUFBQSxDQUFBO3FCQUNBO2lCQUNBOzs7QUFHQSxvQkFBQSxDQUFBLEtBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBO0FBQ0EseUJBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxHQUFBLE1BQUEsQ0FBQSxvQkFBQSxDQUFBLE9BQUEsQ0FBQSwwQkFBQSxFQUFBLEVBQUEsQ0FBQSxDQUFBO2lCQUNBO0FBQ0EsdUJBQUEsQ0FBQSxHQUFBLENBQUEsU0FBQSxFQUFBLFFBQUEsQ0FBQSxDQUFBO0FBQ0EscUJBQUEsQ0FBQSxLQUFBLENBQUEsUUFBQSxDQUFBLElBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQTtBQUNBLHFCQUFBLENBQUEsS0FBQSxDQUFBLFFBQUEsQ0FBQSxJQUFBLEVBQUEsQ0FBQTtBQUNBLG9CQUFBLFVBQUEsR0FBQSxZQUFBLENBQUEsNEJBQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxDQUFBLE1BQUEsRUFBQSxRQUFBLENBQUEsQ0FBQTtBQUNBLHVCQUFBLENBQUEsT0FBQSxDQUFBLFNBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBLE1BQUEsQ0FBQSxRQUFBLENBQUEsaURBQUEsR0FBQSxRQUFBLEdBQUEsa0JBQUEsR0FBQSxVQUFBLEdBQUEsa0JBQUEsR0FBQSxLQUFBLEdBQUEsR0FBQSxHQUFBLFFBQUEsR0FBQSwyQkFBQSxHQUFBLEtBQUEsR0FBQSxzREFBQSxDQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQTtBQUNBLG9CQUFBLE1BQUEsR0FBQSxRQUFBLENBQUEsY0FBQSxDQUFBLFVBQUEsR0FBQSxLQUFBLEdBQUEsR0FBQSxHQUFBLFFBQUEsQ0FBQSxDQUFBO0FBQ0EsMEJBQUEsQ0FBQSxHQUFBLEVBQUEsRUFBQSxFQUFBLE1BQUEsQ0FBQSxVQUFBLENBQUEsSUFBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQTtBQUNBLHVCQUFBLENBQUEsR0FBQSxDQUFBLE9BQUEsRUFBQSxLQUFBLENBQUEsS0FBQSxDQUFBLENBQUE7YUFDQSxDQUFBOztBQUVBLGlCQUFBLENBQUEsY0FBQSxHQUFBLFVBQUEsYUFBQSxFQUFBLFVBQUEsRUFBQTtBQUNBLHVCQUFBLElBQUEsRUFBQSxDQUFBLFVBQUEsT0FBQSxFQUFBLE1BQUEsRUFBQTs7QUFFQSxnQ0FBQSxDQUFBLG1CQUFBLENBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUEsYUFBQSxFQUFBLFVBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQTtpQkFDQSxDQUFBLENBQUE7YUFDQSxDQUFBOztBQUdBLGlCQUFBLENBQUEsaUJBQUEsR0FBQSxVQUFBLFFBQUEsRUFBQTtBQUNBLG9CQUFBLFVBQUEsR0FBQSxLQUFBLENBQUEsT0FBQSxDQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQ0Esb0JBQUEsU0FBQSxHQUFBLEtBQUEsQ0FBQSxLQUFBLENBQUEsUUFBQSxDQUFBLE9BQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQTtBQUNBLHVCQUFBLENBQUEsR0FBQSxDQUFBLFVBQUEsRUFBQSxVQUFBLEVBQUEsUUFBQSxDQUFBLENBQUE7QUFDQSx1QkFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxDQUFBLFFBQUEsQ0FBQSxPQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsQ0FBQTtBQUNBLG9CQUFBLEtBQUEsQ0FBQSxLQUFBLENBQUEsVUFBQSxFQUFBO0FBQ0Esd0JBQUEsU0FBQSxLQUFBLENBQUEsQ0FBQSxFQUFBO0FBQ0EsNEJBQUEsU0FBQSxHQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxzQkFBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBO0FBQ0EsNkJBQUEsQ0FBQSxLQUFBLENBQUEsUUFBQSxDQUFBLElBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQTtBQUNBLDZCQUFBLENBQUEsS0FBQSxDQUFBLFFBQUEsQ0FBQSxJQUFBLEVBQUEsQ0FBQTtBQUNBLCtCQUFBLENBQUEsR0FBQSxDQUFBLEtBQUEsQ0FBQSxLQUFBLENBQUEsUUFBQSxDQUFBLENBQUE7QUFDQSw0QkFBQSxVQUFBLEdBQUEsWUFBQSxDQUFBLDRCQUFBLENBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUEsUUFBQSxDQUFBLENBQUE7QUFDQSwrQkFBQSxDQUFBLE9BQUEsQ0FBQSxTQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsUUFBQSxDQUFBLGlEQUFBLEdBQUEsUUFBQSxHQUFBLGtCQUFBLEdBQUEsVUFBQSxHQUFBLGtCQUFBLEdBQUEsVUFBQSxHQUFBLEdBQUEsR0FBQSxRQUFBLEdBQUEsMkJBQUEsR0FBQSxVQUFBLEdBQUEsc0RBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLENBQUE7O0FBRUEsNEJBQUEsTUFBQSxHQUFBLFFBQUEsQ0FBQSxjQUFBLENBQUEsVUFBQSxHQUFBLFVBQUEsR0FBQSxHQUFBLEdBQUEsUUFBQSxDQUFBLENBQUE7QUFDQSxrQ0FBQSxDQUFBLEdBQUEsRUFBQSxFQUFBLEVBQUEsTUFBQSxDQUFBLFVBQUEsQ0FBQSxJQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsS0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBO3FCQUNBLE1BQUE7Ozs0QkFPQSxhQUFBLEdBQUEsU0FBQSxhQUFBLENBQUEsT0FBQSxFQUFBO0FBQ0EsbUNBQUEsSUFBQSxPQUFBLENBQUEsVUFBQSxJQUFBLE9BQUEsQ0FBQSxVQUFBLENBQUEsV0FBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBO3lCQUNBOztBQVJBLDRCQUFBLE1BQUEsR0FBQSxRQUFBLENBQUEsY0FBQSxDQUFBLFVBQUEsR0FBQSxVQUFBLEdBQUEsR0FBQSxHQUFBLFFBQUEsQ0FBQSxDQUFBOztBQUVBLDZCQUFBLENBQUEsS0FBQSxDQUFBLFFBQUEsQ0FBQSxNQUFBLENBQUEsU0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFBOztBQUVBLG9DQUFBLENBQUEsa0JBQUEsQ0FBQSxNQUFBLENBQUEsVUFBQSxDQUFBLFVBQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQTtBQUtBLHFDQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7cUJBQ0E7aUJBQ0EsTUFBQTtBQUNBLDJCQUFBLENBQUEsR0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBO2lCQUNBO2FBQ0EsQ0FBQTs7QUFFQSxpQkFBQSxDQUFBLFFBQUEsR0FBQSxVQUFBLEtBQUEsRUFBQTtBQUNBLHVCQUFBLENBQUEsR0FBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBO0FBQ0EsdUJBQUEsQ0FBQSxHQUFBLENBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBOztBQUVBLHFCQUFBLENBQUEsS0FBQSxDQUFBLEtBQUEsR0FBQSxJQUFBLENBQUE7QUFDQSxxQkFBQSxDQUFBLEtBQUEsQ0FBQSxVQUFBLEdBQUEsS0FBQSxDQUFBO0FBQ0EscUJBQUEsQ0FBQSxLQUFBLENBQUEsTUFBQSxHQUFBLElBQUEsQ0FBQTtBQUNBLHFCQUFBLENBQUEsS0FBQSxDQUFBLE9BQUEsR0FBQSxLQUFBLENBQUE7QUFDQSxxQkFBQSxDQUFBLEtBQUEsQ0FBQSxRQUFBLEdBQUEsSUFBQSxDQUFBO0FBQ0EscUJBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxHQUFBLElBQUEsQ0FBQTtBQUNBLHFCQUFBLENBQUEsS0FBQSxDQUFBLFVBQUEsR0FBQSxLQUFBLENBQUE7O0FBRUEscUJBQUEsQ0FBQSxLQUFBLENBQUEsV0FBQSxDQUFBLE9BQUEsQ0FBQSxVQUFBLE1BQUEsRUFBQTtBQUNBLDBCQUFBLENBQUEsT0FBQSxFQUFBLENBQUE7aUJBQ0EsQ0FBQSxDQUFBO0FBQ0EscUJBQUEsQ0FBQSxLQUFBLENBQUEsV0FBQSxHQUFBLFlBQUEsQ0FBQSxpQkFBQSxFQUFBLENBQUE7QUFDQSxxQkFBQSxDQUFBLEtBQUEsQ0FBQSxRQUFBLEdBQUEsRUFBQSxDQUFBOztBQUVBLG9CQUFBLE9BQUEsR0FBQSxRQUFBLENBQUEsc0JBQUEsQ0FBQSxXQUFBLEdBQUEsS0FBQSxDQUFBLFFBQUEsRUFBQSxDQUFBLENBQUE7QUFDQSx1QkFBQSxPQUFBLENBQUEsTUFBQSxLQUFBLENBQUEsRUFBQTtBQUNBLHlCQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsT0FBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtBQUNBLCtCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsVUFBQSxDQUFBLFdBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FB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QUE7O0FBRUEsbUNBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxHQUFBLEVBQUEsR0FBQSxDQUFBLENBQUE7QUFDQSxtQ0FBQSxDQUFBLFNBQUEsR0FBQSxTQUFBLENBQUE7QUFDQSxtQ0FBQSxDQUFBLE9BQUEsR0FBQSxPQUFBLENBQUE7QUFDQSx3QkFBQSxVQUFBLEdBQUEsWUFBQSxDQUFBLGlCQUFBLEdBQUEsT0FBQSxDQUFBOzs7QUFHQSx5QkFBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLE9BQUEsRUFBQSxFQUFBLENBQUEsRUFBQTtBQUNBLDRCQUFBLFNBQUEsR0FBQSxDQUFBLENBQUE7QUFDQSw0QkFBQSxNQUFBLEdBQUEsSUFBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLEdBQUEsVUFBQSxDQUFBLENBQUE7O0FBRUEsNkJBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxVQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQ0EsU0FBQSxJQUFBLFlBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUE7QUFDQSxpQ0FBQSxHQUFBLFNBQUEsR0FBQSxVQUFBLENBQUE7QUFDQSw0QkFBQSxVQUFBLEdBQUEsWUFBQSxDQUFBLENBQUEsR0FBQSxVQUFBLENBQUEsQ0FBQTtBQUNBLHVDQUFBLENBQUEsU0FBQSxHQUFBLE9BQUEsR0FBQSxJQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsT0FBQSxDQUFBLEdBQUEsY0FBQSxDQUFBO0FBQ0EsdUNBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxHQUFBLE9BQUEsRUFBQSxHQUFBLEVBQUEsU0FBQSxFQUFBLENBQUEsU0FBQSxDQUFBLENBQUE7cUJBQ0E7QUFDQSx3QkFBQSxjQUFBLEVBQUE7QUFDQSw4QkFBQSxDQUFBLHFCQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7cUJBQ0E7aUJBQ0E7O0FBRUEsc0JBQUEsQ0FBQSxVQUFBLENBQUEsWUFBQTtBQUNBLCtCQUFBLENBQUEsVUFBQSxDQUFBLEtBQUEsRUFBQSxRQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxNQUFBLEVBQUE7QUFDQSw2QkFBQSxDQUFBLEtBQUEsQ0FBQSxTQUFBLEdBQUEsS0FBQSxDQUFBO0FBQ0EsNkJBQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxHQUFBLEtBQUEsQ0FBQTtBQUNBLHNDQUFBLEdBQUEsS0FBQSxDQUFBO0FBQ0EsOEJBQUEsQ0FBQSxvQkFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBO0FBQ0EsNkJBQUEsQ0FBQSxLQUFBLENBQUEsTUFBQSxHQUFBLE1BQUEsQ0FBQTtBQUNBLDZCQUFBLENBQUEsS0FBQSxDQUFBLE1BQUEsQ0FBQSxJQUFBLEdBQUEsSUFBQSxDQUFBO0FBQ0EsNkJBQUEsQ0FBQSxLQUFBLENBQUEsTUFBQSxHQUFBLE1BQUEsQ0FBQSxZQUFBLENBQUE7QUFDQSw2QkFBQSxDQUFBLEtBQUEsQ0FBQSxRQUFBLEdBQUEsTUFBQSxDQUFBLGVBQUEsQ0FBQTtBQUNBLDhCQUFBLENBQUEsT0FBQSxDQUFBLEtBQUEsQ0FBQSxLQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7QUFDQSw2QkFBQSxDQUFBLE9BQUEsQ0FBQSxTQUFBLENBQUEsSUFBQSxFQUFBLENBQUE7QUFDQSw4QkFBQSxDQUFBLGFBQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQTs7QUFFQSw2QkFBQSxDQUFBLE9BQUEsQ0FBQSxJQUFBLEVBQUEsQ0FBQTtBQUNBLHVDQUFBLENBQUEsU0FBQSxDQUFBLEtBQUEsQ0FBQSxPQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7cUJBQ0EsQ0FBQSxDQUFBO2lCQUNBLEVBQUEsSUFBQSxDQUFBLENBQUE7O0FBRUEsc0JBQUEsQ0FBQSxVQUFBLENBQUEsWUFBQTtBQUNBLCtCQUFBLENBQUEsV0FBQSxDQUFBLFFBQUEsRUFBQSxLQUFBLENBQUEsQ0FBQTtpQkFDQSxFQUFBLElBQUEsQ0FBQSxDQUFBO0FBQ0EscUJBQUEsQ0FBQSxPQUFBLENBQUEsU0FBQSxDQUFBLEtBQUEsRUFBQSxDQUFBOztBQUVBLG9CQUFBLEtBQUEsR0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLFlBQUE7QUFDQSx5QkFBQSxDQUFBLE9BQUEsQ0FBQSxTQUFBLENBQUEsSUFBQSxFQUFBLENBQUE7QUFDQSx5QkFBQSxDQUFBLE9BQUEsQ0FBQSxTQUFBLENBQUEsS0FBQSxFQUFBLENBQUE7aUJBQ0EsRUFBQSxHQUFBLENBQUEsQ0FBQTthQUVBLENBQUE7QUFDQSxpQkFBQSxDQUFBLE9BQUEsR0FBQSxVQUFBLG1CQUFBLEVBQUE7QUFDQSx1QkFBQSxDQUFBLEdBQUEsQ0FBQSxtQkFBQSxDQUFBLENBQUE7QUFDQSxvQkFBQSxtQkFBQSxFQUFBO0FBQ0EseUJBQUEsQ0FBQSxLQUFBLENBQUEsTUFBQSxDQUFBLElBQUEsRUFBQSxDQUFBO0FBQ0EseUJBQUEsQ0FBQSxLQUFBLENBQUEsVUFBQSxHQUFBLEtBQUEsQ0FBQTtpQkFDQSxNQUFBO0FBQ0EseUJBQUEsQ0FBQSxLQUFBLENBQUEsTUFBQSxDQUFBLEtBQUEsRUFBQSxDQUFBO0FBQ0EseUJBQUEsQ0FBQSxLQUFBLENBQUEsVUFBQSxHQUFBLElBQUEsQ0FBQTtpQkFDQTthQUNBLENBQUE7O0FBRUEsaUJBQUEsQ0FBQSxhQUFBLEdBQUEsVUFBQSxNQUFBLEVBQUEsTUFBQSxFQUFBO0FBQ0EsdUJBQUEsQ0FBQSxHQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7QUFDQSx1QkFBQSxDQUFBLEdBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQTs7QUFFQSxzQkFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLEdBQUEsTUFBQSxHQUFBLElBQUEsQ0FBQTthQUNBLENBQUE7U0FFQTs7S0FHQSxDQUFBO0NBQ0EsQ0FBQSxDQUFBIiwiZmlsZSI6Im1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG52YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ0Z1bGxzdGFja0dlbmVyYXRlZEFwcCcsIFsndWkucm91dGVyJywgJ3VpLmJvb3RzdHJhcCcsICdmc2FQcmVCdWlsdCcsICduZ1N0b3JhZ2UnXSk7XG5cbmFwcC5jb25maWcoZnVuY3Rpb24gKCR1cmxSb3V0ZXJQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgICAvLyBUaGlzIHR1cm5zIG9mZiBoYXNoYmFuZyB1cmxzICgvI2Fib3V0KSBhbmQgY2hhbmdlcyBpdCB0byBzb21ldGhpbmcgbm9ybWFsICgvYWJvdXQpXG4gICAgJGxvY2F0aW9uUHJvdmlkZXIuaHRtbDVNb2RlKHRydWUpO1xuICAgIC8vIElmIHdlIGdvIHRvIGEgVVJMIHRoYXQgdWktcm91dGVyIGRvZXNuJ3QgaGF2ZSByZWdpc3RlcmVkLCBnbyB0byB0aGUgXCIvXCIgdXJsLlxuICAgICR1cmxSb3V0ZXJQcm92aWRlci5vdGhlcndpc2UoJy8nKTtcbn0pO1xuXG4vLyBUaGlzIGFwcC5ydW4gaXMgZm9yIGNvbnRyb2xsaW5nIGFjY2VzcyB0byBzcGVjaWZpYyBzdGF0ZXMuXG5hcHAucnVuKGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlKSB7XG5cbiAgICAvLyBUaGUgZ2l2ZW4gc3RhdGUgcmVxdWlyZXMgYW4gYXV0aGVudGljYXRlZCB1c2VyLlxuICAgIHZhciBkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgIHJldHVybiBzdGF0ZS5kYXRhICYmIHN0YXRlLmRhdGEuYXV0aGVudGljYXRlO1xuICAgIH07XG5cbiAgICAvLyAkc3RhdGVDaGFuZ2VTdGFydCBpcyBhbiBldmVudCBmaXJlZFxuICAgIC8vIHdoZW5ldmVyIHRoZSBwcm9jZXNzIG9mIGNoYW5naW5nIGEgc3RhdGUgYmVnaW5zLlxuICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VTdGFydCcsIGZ1bmN0aW9uIChldmVudCwgdG9TdGF0ZSwgdG9QYXJhbXMpIHtcblxuICAgICAgICBpZiAoIWRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGgodG9TdGF0ZSkpIHtcbiAgICAgICAgICAgIC8vIFRoZSBkZXN0aW5hdGlvbiBzdGF0ZSBkb2VzIG5vdCByZXF1aXJlIGF1dGhlbnRpY2F0aW9uXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpKSB7XG4gICAgICAgICAgICAvLyBUaGUgdXNlciBpcyBhdXRoZW50aWNhdGVkLlxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbmNlbCBuYXZpZ2F0aW5nIHRvIG5ldyBzdGF0ZS5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAvLyBJZiBhIHVzZXIgaXMgcmV0cmlldmVkLCB0aGVuIHJlbmF2aWdhdGUgdG8gdGhlIGRlc3RpbmF0aW9uXG4gICAgICAgICAgICAvLyAodGhlIHNlY29uZCB0aW1lLCBBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSB3aWxsIHdvcmspXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UsIGlmIG5vIHVzZXIgaXMgbG9nZ2VkIGluLCBnbyB0byBcImxvZ2luXCIgc3RhdGUuXG4gICAgICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbyh0b1N0YXRlLm5hbWUsIHRvUGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdsb2dpbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH0pO1xuXG59KTsiLCIoZnVuY3Rpb24gKCkge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gSG9wZSB5b3UgZGlkbid0IGZvcmdldCBBbmd1bGFyISBEdWgtZG95LlxuICAgIGlmICghd2luZG93LmFuZ3VsYXIpIHRocm93IG5ldyBFcnJvcignSSBjYW5cXCd0IGZpbmQgQW5ndWxhciEnKTtcblxuICAgIHZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgnZnNhUHJlQnVpbHQnLCBbXSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnU29ja2V0JywgZnVuY3Rpb24gKCRsb2NhdGlvbikge1xuICAgICAgICBpZiAoIXdpbmRvdy5pbykgdGhyb3cgbmV3IEVycm9yKCdzb2NrZXQuaW8gbm90IGZvdW5kIScpO1xuICAgICAgICByZXR1cm4gd2luZG93LmlvKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4pO1xuICAgIH0pO1xuXG4gICAgLy8gQVVUSF9FVkVOVFMgaXMgdXNlZCB0aHJvdWdob3V0IG91ciBhcHAgdG9cbiAgICAvLyBicm9hZGNhc3QgYW5kIGxpc3RlbiBmcm9tIGFuZCB0byB0aGUgJHJvb3RTY29wZVxuICAgIC8vIGZvciBpbXBvcnRhbnQgZXZlbnRzIGFib3V0IGF1dGhlbnRpY2F0aW9uIGZsb3cuXG4gICAgYXBwLmNvbnN0YW50KCdBVVRIX0VWRU5UUycsIHtcbiAgICAgICAgbG9naW5TdWNjZXNzOiAnYXV0aC1sb2dpbi1zdWNjZXNzJyxcbiAgICAgICAgbG9naW5GYWlsZWQ6ICdhdXRoLWxvZ2luLWZhaWxlZCcsXG4gICAgICAgIGxvZ291dFN1Y2Nlc3M6ICdhdXRoLWxvZ291dC1zdWNjZXNzJyxcbiAgICAgICAgc2Vzc2lvblRpbWVvdXQ6ICdhdXRoLXNlc3Npb24tdGltZW91dCcsXG4gICAgICAgIG5vdEF1dGhlbnRpY2F0ZWQ6ICdhdXRoLW5vdC1hdXRoZW50aWNhdGVkJyxcbiAgICAgICAgbm90QXV0aG9yaXplZDogJ2F1dGgtbm90LWF1dGhvcml6ZWQnXG4gICAgfSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnQXV0aEludGVyY2VwdG9yJywgZnVuY3Rpb24gKCRyb290U2NvcGUsICRxLCBBVVRIX0VWRU5UUykge1xuICAgICAgICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICAgICAgICAgIDQwMTogQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCxcbiAgICAgICAgICAgIDQwMzogQVVUSF9FVkVOVFMubm90QXV0aG9yaXplZCxcbiAgICAgICAgICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgICAgICAgICA0NDA6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZUVycm9yOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfSk7XG5cbiAgICBhcHAuY29uZmlnKGZ1bmN0aW9uICgkaHR0cFByb3ZpZGVyKSB7XG4gICAgICAgICRodHRwUHJvdmlkZXIuaW50ZXJjZXB0b3JzLnB1c2goW1xuICAgICAgICAgICAgJyRpbmplY3RvcicsXG4gICAgICAgICAgICBmdW5jdGlvbiAoJGluamVjdG9yKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRpbmplY3Rvci5nZXQoJ0F1dGhJbnRlcmNlcHRvcicpO1xuICAgICAgICAgICAgfVxuICAgICAgICBdKTtcbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdBdXRoU2VydmljZScsIGZ1bmN0aW9uICgkaHR0cCwgU2Vzc2lvbiwgJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMsICRxKSB7XG5cbiAgICAgICAgLy8gVXNlcyB0aGUgc2Vzc2lvbiBmYWN0b3J5IHRvIHNlZSBpZiBhblxuICAgICAgICAvLyBhdXRoZW50aWNhdGVkIHVzZXIgaXMgY3VycmVudGx5IHJlZ2lzdGVyZWQuXG4gICAgICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICEhU2Vzc2lvbi51c2VyO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ2V0TG9nZ2VkSW5Vc2VyID0gZnVuY3Rpb24gKCkge1xuXG4gICAgICAgICAgICAvLyBJZiBhbiBhdXRoZW50aWNhdGVkIHNlc3Npb24gZXhpc3RzLCB3ZVxuICAgICAgICAgICAgLy8gcmV0dXJuIHRoZSB1c2VyIGF0dGFjaGVkIHRvIHRoYXQgc2Vzc2lvblxuICAgICAgICAgICAgLy8gd2l0aCBhIHByb21pc2UuIFRoaXMgZW5zdXJlcyB0aGF0IHdlIGNhblxuICAgICAgICAgICAgLy8gYWx3YXlzIGludGVyZmFjZSB3aXRoIHRoaXMgbWV0aG9kIGFzeW5jaHJvbm91c2x5LlxuICAgICAgICAgICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEud2hlbihTZXNzaW9uLnVzZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBNYWtlIHJlcXVlc3QgR0VUIC9zZXNzaW9uLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIHVzZXIsIGNhbGwgb25TdWNjZXNzZnVsTG9naW4gd2l0aCB0aGUgcmVzcG9uc2UuXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgNDAxIHJlc3BvbnNlLCB3ZSBjYXRjaCBpdCBhbmQgaW5zdGVhZCByZXNvbHZlIHRvIG51bGwuXG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvc2Vzc2lvbicpLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dpbiA9IGZ1bmN0aW9uIChjcmVkZW50aWFscykge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9sb2dpbicsIGNyZWRlbnRpYWxzKVxuICAgICAgICAgICAgICAgIC50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdCh7IG1lc3NhZ2U6ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLicgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvbG9nb3V0JykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgU2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gb25TdWNjZXNzZnVsTG9naW4ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgIFNlc3Npb24uY3JlYXRlKGRhdGEuaWQsIGRhdGEudXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzKTtcbiAgICAgICAgICAgIHJldHVybiBkYXRhLnVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNpZ251cCA9IGZ1bmN0aW9uIChjcmVkZW50aWFscykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coY3JlZGVudGlhbHMpO1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9zaWdudXAnLCBjcmVkZW50aWFscylcbiAgICAgICAgICAgICAgICAudGhlbiggb25TdWNjZXNzZnVsTG9naW4gKVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdCh7IG1lc3NhZ2U6ICdJbnZhbGlkIHNpZ251cCBjcmVkZW50aWFscy4nIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ1Nlc3Npb24nLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5pZCA9IG51bGw7XG4gICAgICAgIHRoaXMudXNlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jcmVhdGUgPSBmdW5jdGlvbiAoc2Vzc2lvbklkLCB1c2VyKSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gc2Vzc2lvbklkO1xuICAgICAgICAgICAgdGhpcy51c2VyID0gdXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IG51bGw7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxufSkoKTsiLCIndXNlIHN0cmljdCc7XG5hcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdob21lJywge1xuICAgICAgICB1cmw6ICcvJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9ob21lL2hvbWUuaHRtbCdcbiAgICB9KTtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdob21lLmxhbmRpbmcnLHtcbiAgICBcdHVybDogJy9sYW5kaW5nJyxcbiAgICBcdHRlbXBsYXRlVXJsOiAnanMvaG9tZS9sYW5kaW5nLmh0bWwnXG4gICAgfSlcbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsb2dpbicsIHtcbiAgICAgICAgdXJsOiAnL2xvZ2luJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9sb2dpbi9sb2dpbi5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ0xvZ2luQ3RybCdcbiAgICB9KTtcblxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdMb2dpbkN0cmwnLCBmdW5jdGlvbigkc2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUpIHtcblxuICAgICRzY29wZS5sb2dpbiA9IHt9O1xuICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAkc2NvcGUuc2VuZExvZ2luID0gZnVuY3Rpb24obG9naW5JbmZvKSB7XG5cbiAgICAgICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICAgICBBdXRoU2VydmljZS5sb2dpbihsb2dpbkluZm8pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICRzY29wZS5lcnJvciA9ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLic7XG4gICAgICAgIH0pO1xuXG4gICAgfTtcblxufSk7IiwiJ3VzZSBzdHJpY3QnO1xuYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgncHJvamVjdCcsIHtcbiAgICAgICAgdXJsOiAnL3Byb2plY3QvOnByb2plY3RJRCcsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvcHJvamVjdC9wcm9qZWN0Lmh0bWwnXG4gICAgfSk7XG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ1Byb2plY3RDb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCAkc3RhdGVQYXJhbXMsICRjb21waWxlLCBSZWNvcmRlckZjdCwgUHJvamVjdEZjdCwgVG9uZVRyYWNrRmN0LCBUb25lVGltZWxpbmVGY3QsIEF1dGhTZXJ2aWNlKSB7XG5cblx0d2luZG93Lm9uYmx1ciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgJHNjb3BlLnN0b3AoKTtcbiAgICB9O1xuXG5cdHZhciBtYXhNZWFzdXJlID0gMDtcblxuXHQvLyBudW1iZXIgb2YgbWVhc3VyZXMgb24gdGhlIHRpbWVsaW5lXG5cdCRzY29wZS5udW1NZWFzdXJlcyA9IF8ucmFuZ2UoMCwgNjApO1xuXG5cdC8vIGxlbmd0aCBvZiB0aGUgdGltZWxpbmVcblx0JHNjb3BlLm1lYXN1cmVMZW5ndGggPSAxO1xuXG5cdC8vSW5pdGlhbGl6ZSByZWNvcmRlciBvbiBwcm9qZWN0IGxvYWRcblx0UmVjb3JkZXJGY3QucmVjb3JkZXJJbml0KCkudGhlbihmdW5jdGlvbiAocmV0QXJyKSB7XG5cdFx0JHNjb3BlLnJlY29yZGVyID0gcmV0QXJyWzBdO1xuXHRcdCRzY29wZS5hbmFseXNlck5vZGUgPSByZXRBcnJbMV07XG5cdH0pLmNhdGNoKGZ1bmN0aW9uIChlKXtcbiAgICAgICAgYWxlcnQoJ0Vycm9yIGdldHRpbmcgYXVkaW8nKTtcbiAgICAgICAgY29uc29sZS5sb2coZSk7XG4gICAgfSk7XG5cblx0JHNjb3BlLm1lYXN1cmVMZW5ndGggPSAxO1xuXHQkc2NvcGUubmFtZUNoYW5naW5nID0gZmFsc2U7XG5cdCRzY29wZS50cmFja3MgPSBbXTtcblx0JHNjb3BlLmxvYWRpbmcgPSB0cnVlO1xuXHQkc2NvcGUucHJvamVjdElkID0gJHN0YXRlUGFyYW1zLnByb2plY3RJRDtcblx0JHNjb3BlLnBvc2l0aW9uID0gMDtcblx0JHNjb3BlLnBsYXlpbmcgPSBmYWxzZTtcblxuXHRQcm9qZWN0RmN0LmdldFByb2plY3RJbmZvKCRzY29wZS5wcm9qZWN0SWQpLnRoZW4oZnVuY3Rpb24gKHByb2plY3QpIHtcblx0XHR2YXIgbG9hZGVkID0gMDtcblx0XHRjb25zb2xlLmxvZygnUFJPSkVDVCcsIHByb2plY3QpO1xuXHRcdCRzY29wZS5wcm9qZWN0TmFtZSA9IHByb2plY3QubmFtZTtcblxuXHRcdGlmIChwcm9qZWN0LnRyYWNrcy5sZW5ndGgpIHtcblx0XHRcdHByb2plY3QudHJhY2tzLmZvckVhY2goZnVuY3Rpb24gKHRyYWNrKSB7XG5cdFx0XHRcdHZhciBkb25lTG9hZGluZyA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRsb2FkZWQrKztcblx0XHRcdFx0XHRpZihsb2FkZWQgPT09IHByb2plY3QudHJhY2tzLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0JHNjb3BlLmxvYWRpbmcgPSBmYWxzZTtcblx0XHRcdFx0XHRcdC8vIFRvbmUuVHJhbnNwb3J0LnN0YXJ0KCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0XHR2YXIgbWF4ID0gTWF0aC5tYXguYXBwbHkobnVsbCwgdHJhY2subG9jYXRpb24pO1xuXHRcdFx0XHRpZihtYXggKyAyID4gbWF4TWVhc3VyZSkgbWF4TWVhc3VyZSA9IG1heCArIDI7XG5cdFx0XHRcdFxuXHRcdFx0XHR0cmFjay5lbXB0eSA9IGZhbHNlO1xuXHRcdFx0XHR0cmFjay5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgICBcdFx0XHR0cmFjay5zaWxlbmNlID0gZmFsc2U7XG5cblx0XHRcdFx0Ly8gVE9ETzogdGhpcyBpcyBhc3N1bWluZyB0aGF0IGEgcGxheWVyIGV4aXN0c1xuXHRcdFx0XHR0cmFjay5wbGF5ZXIgPSBUb25lVHJhY2tGY3QuY3JlYXRlUGxheWVyKHRyYWNrLnVybCwgZG9uZUxvYWRpbmcpO1xuXHRcdFx0XHQvL2luaXQgZWZmZWN0cywgY29ubmVjdCwgYW5kIGFkZCB0byBzY29wZVxuXHRcdFx0XHR0cmFjay5lZmZlY3RzUmFjayA9IFRvbmVUcmFja0ZjdC5lZmZlY3RzSW5pdGlhbGl6ZSgpO1xuXHRcdFx0XHR0cmFjay5wbGF5ZXIuY29ubmVjdCh0cmFjay5lZmZlY3RzUmFja1swXSk7XG5cblx0XHRcdFx0aWYodHJhY2subG9jYXRpb24ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0VG9uZVRpbWVsaW5lRmN0LmFkZExvb3BUb1RpbWVsaW5lKHRyYWNrLnBsYXllciwgdHJhY2subG9jYXRpb24pO1xuXHRcdFx0XHRcdHRyYWNrLm9uVGltZWxpbmUgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRyYWNrLm9uVGltZWxpbmUgPSBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdCRzY29wZS50cmFja3MucHVzaCh0cmFjayk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0JHNjb3BlLm1heE1lYXN1cmUgPSAzMjtcbiAgXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCA4OyBpKyspIHtcbiAgICBcdFx0XHRcdHZhciBvYmogPSB7fTtcbiAgICBcdFx0XHRcdG9iai5lbXB0eSA9IHRydWU7XG4gICAgXHRcdFx0XHRvYmoucmVjb3JkaW5nID0gZmFsc2U7XG4gICAgXHRcdFx0XHRvYmoub25UaW1lbGluZSA9IGZhbHNlO1xuICAgIFx0XHRcdFx0b2JqLnByZXZpZXdpbmcgPSBmYWxzZTtcbiAgICBcdFx0XHRcdG9iai5zaWxlbmNlID0gZmFsc2U7XG4gICAgXHRcdFx0XHRvYmouZWZmZWN0c1JhY2sgPSBUb25lVHJhY2tGY3QuZWZmZWN0c0luaXRpYWxpemUoKTtcbiAgICBcdFx0XHRcdG9iai5wbGF5ZXIgPSBudWxsO1xuICAgIFx0XHRcdFx0b2JqLm5hbWUgPSAnVHJhY2sgJyArIChpKzEpO1xuICAgIFx0XHRcdFx0b2JqLmxvY2F0aW9uID0gW107XG4gICAgXHRcdFx0XHQkc2NvcGUudHJhY2tzLnB1c2gob2JqKTtcbiAgXHRcdFx0fVxuXHRcdCAgfVxuXG5cdFx0Ly9keW5hbWljYWxseSBzZXQgbWVhc3VyZXNcblx0XHQvL2lmIGxlc3MgdGhhbiAxNiBzZXQgMTggYXMgbWluaW11bVxuXHRcdCRzY29wZS5udW1NZWFzdXJlcyA9IFtdO1xuXHRcdGlmKG1heE1lYXN1cmUgPCAzMikgbWF4TWVhc3VyZSA9IDM0O1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbWF4TWVhc3VyZTsgaSsrKSB7XG5cdFx0XHQkc2NvcGUubnVtTWVhc3VyZXMucHVzaChpKTtcblx0XHR9XG5cdFx0Y29uc29sZS5sb2coJ01FQVNVUkVTJywgJHNjb3BlLm51bU1lYXN1cmVzKTtcblxuXG5cblx0XHRUb25lVGltZWxpbmVGY3QuY3JlYXRlVHJhbnNwb3J0KHByb2plY3QuZW5kTWVhc3VyZSkudGhlbihmdW5jdGlvbiAobWV0cm9ub21lKSB7XG5cdFx0XHQkc2NvcGUubWV0cm9ub21lID0gbWV0cm9ub21lO1xuXHRcdH0pO1xuXHRcdFRvbmVUaW1lbGluZUZjdC5jaGFuZ2VCcG0ocHJvamVjdC5icG0pO1xuXG5cdH0pO1xuXG5cdCRzY29wZS5kcm9wSW5UaW1lbGluZSA9IGZ1bmN0aW9uIChpbmRleCkge1xuXHRcdHZhciB0cmFjayA9IHNjb3BlLnRyYWNrc1tpbmRleF07XG5cdH1cblxuXHQkc2NvcGUuYWRkVHJhY2sgPSBmdW5jdGlvbiAoKSB7XG5cblx0fTtcblxuXHQkc2NvcGUucGxheSA9IGZ1bmN0aW9uICgpIHtcblx0XHQkc2NvcGUucGxheWluZyA9IHRydWU7XG5cdFx0VG9uZS5UcmFuc3BvcnQucG9zaXRpb24gPSAkc2NvcGUucG9zaXRpb24udG9TdHJpbmcoKSArIFwiOjA6MFwiO1xuXHRcdFRvbmUuVHJhbnNwb3J0LnN0YXJ0KCk7XG5cdH1cblx0JHNjb3BlLnBhdXNlID0gZnVuY3Rpb24gKCkge1xuXHRcdCRzY29wZS5wbGF5aW5nID0gZmFsc2U7XG5cdFx0JHNjb3BlLm1ldHJvbm9tZS5zdG9wKCk7XG5cdFx0VG9uZVRpbWVsaW5lRmN0LnN0b3BBbGwoJHNjb3BlLnRyYWNrcyk7XG5cdFx0JHNjb3BlLnBvc2l0aW9uID0gVG9uZS5UcmFuc3BvcnQucG9zaXRpb24uc3BsaXQoJzonKVswXTtcblx0XHRjb25zb2xlLmxvZygnUE9TJywgJHNjb3BlLnBvc2l0aW9uKTtcblx0XHR2YXIgcGxheUhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhY2tIZWFkJyk7XG5cdFx0cGxheUhlYWQuc3R5bGUubGVmdCA9ICgkc2NvcGUucG9zaXRpb24gKiAyMDAgKyAzMDApLnRvU3RyaW5nKCkrJ3B4Jztcblx0XHRUb25lLlRyYW5zcG9ydC5wYXVzZSgpO1xuXHR9XG5cdCRzY29wZS5zdG9wID0gZnVuY3Rpb24gKCkge1xuXHRcdCRzY29wZS5wbGF5aW5nID0gZmFsc2U7XG5cdFx0JHNjb3BlLm1ldHJvbm9tZS5zdG9wKCk7XG5cdFx0VG9uZVRpbWVsaW5lRmN0LnN0b3BBbGwoJHNjb3BlLnRyYWNrcyk7XG5cdFx0JHNjb3BlLnBvc2l0aW9uID0gMDtcblx0XHR2YXIgcGxheUhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhY2tIZWFkJyk7XG5cdFx0cGxheUhlYWQuc3R5bGUubGVmdCA9ICczMDBweCc7XG5cdFx0VG9uZS5UcmFuc3BvcnQuc3RvcCgpO1xuXHR9XG5cdCRzY29wZS5uYW1lQ2hhbmdlID0gZnVuY3Rpb24obmV3TmFtZSkge1xuXHRcdCRzY29wZS5uYW1lQ2hhbmdpbmcgPSBmYWxzZTtcblx0fVxuXG5cdCRzY29wZS50b2dnbGVNZXRyb25vbWUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0aWYoJHNjb3BlLm1ldHJvbm9tZS52b2x1bWUudmFsdWUgPT09IDApIHtcblx0XHRcdCRzY29wZS5tZXRyb25vbWUudm9sdW1lLnZhbHVlID0gLTEwMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0JHNjb3BlLm1ldHJvbm9tZS52b2x1bWUudmFsdWUgPSAwO1xuXHRcdH1cblx0fVxuXG4gICRzY29wZS5zZW5kVG9BV1MgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICBSZWNvcmRlckZjdC5zZW5kVG9BV1MoJHNjb3BlLnRyYWNrcywgJHNjb3BlLnByb2plY3RJZCkudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgLy8gd2F2ZSBsb2dpY1xuICAgICAgICBjb25zb2xlLmxvZygncmVzcG9uc2UgZnJvbSBzZW5kVG9BV1MnLCByZXNwb25zZSk7XG5cbiAgICB9KTtcbiAgfTtcbiAgXG4gICRzY29wZS5pc0xvZ2dlZEluID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCk7XG4gICAgfTtcbn0pOyIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnc2lnbnVwJywge1xuICAgICAgICB1cmw6ICcvc2lnbnVwJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9zaWdudXAvc2lnbnVwLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnU2lnbnVwQ3RybCdcbiAgICB9KTtcblxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdTaWdudXBDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlKSB7XG5cbiAgICAkc2NvcGUuc2lnbnVwID0ge307XG4gICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICRzY29wZS5zZW5kU2lnbnVwID0gZnVuY3Rpb24oc2lnbnVwSW5mbykge1xuXG4gICAgICAgICRzY29wZS5lcnJvciA9IG51bGw7XG4gICAgICAgIGNvbnNvbGUubG9nKHNpZ251cEluZm8pO1xuICAgICAgICBBdXRoU2VydmljZS5zaWdudXAoc2lnbnVwSW5mbykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkc3RhdGUuZ28oJ2hvbWUnKTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHNjb3BlLmVycm9yID0gJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJztcbiAgICAgICAgfSk7XG5cbiAgICB9O1xuXG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgndXNlclByb2ZpbGUnLCB7XG4gICAgICAgIHVybDogJy91c2VycHJvZmlsZS86dGhlSUQnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3VzZXIvdXNlcnByb2ZpbGUuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdVc2VyQ29udHJvbGxlcicsXG4gICAgICAgIC8vIFRoZSBmb2xsb3dpbmcgZGF0YS5hdXRoZW50aWNhdGUgaXMgcmVhZCBieSBhbiBldmVudCBsaXN0ZW5lclxuICAgICAgICAvLyB0aGF0IGNvbnRyb2xzIGFjY2VzcyB0byB0aGlzIHN0YXRlLiBSZWZlciB0byBhcHAuanMuXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIGF1dGhlbnRpY2F0ZTogdHJ1ZVxuICAgICAgICB9XG4gICAgfSlcbiAgICAuc3RhdGUoJ3VzZXJQcm9maWxlLmFydGlzdEluZm8nLCB7XG4gICAgICAgIHVybDogJy9pbmZvJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy91c2VyL2luZm8uaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdVc2VyQ29udHJvbGxlcidcbiAgICB9KVxuICAgIC5zdGF0ZSgndXNlclByb2ZpbGUucHJvamVjdCcsIHtcbiAgICAgICAgdXJsOiAnL3Byb2plY3RzJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy91c2VyL3Byb2plY3RzLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnVXNlckNvbnRyb2xsZXInXG4gICAgfSlcbiAgICAuc3RhdGUoJ3VzZXJQcm9maWxlLmZvbGxvd2VycycsIHtcbiAgICAgICAgdXJsOiAnL2ZvbGxvd2VycycsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvdXNlci9mb2xsb3dlcnMuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdVc2VyQ29udHJvbGxlcidcbiAgICB9KVxuICAgIC5zdGF0ZSgndXNlclByb2ZpbGUuZm9sbG93aW5nJywge1xuICAgICAgICB1cmw6ICcvZm9sbG93aW5nJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy91c2VyL2ZvbGxvd2luZy5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ1VzZXJDb250cm9sbGVyJ1xuICAgIH0pO1xuXG59KTtcblxuIiwiXG5hcHAuY29udHJvbGxlcignSG9tZUNvbnRyb2xsZXInLCBmdW5jdGlvbigkc2NvcGUsIEF1dGhTZXJ2aWNlLCBUb25lVHJhY2tGY3QsIFByb2plY3RGY3QsICRzdGF0ZVBhcmFtcywgJHN0YXRlKSB7XG5cdGNvbnNvbGUubG9nKCdpbiBIb21lIGNvbnRyb2xsZXInKTtcblx0dmFyIHRyYWNrQnVja2V0ID0gW107XG5cdCRzY29wZS5pc0xvZ2dlZEluID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCk7XG4gICAgfTtcblxuICAgICRzY29wZS5wcm9qZWN0cyA9IGZ1bmN0aW9uICgpe1xuICAgIFx0Y29uc29sZS5sb2coJ2luIGhlcmUnKVxuICAgIFx0UHJvamVjdEZjdC5nZXRQcm9qZWN0SW5mbygpLnRoZW4oZnVuY3Rpb24ocHJvamVjdHMpe1xuICAgIFx0XHQkc2NvcGUuYWxsUHJvamVjdHM9cHJvamVjdHM7XG4gICAgXHRcdC8vIGNvbnNvbGUubG9nKCdBbGwgUHJvamVjdHMgYXJlJywgcHJvamVjdHMpXG4gICAgXHR9KVxuICAgIH1cblx0JHNjb3BlLnByb2plY3RzKCk7XG5cblx0XHQkc2NvcGUubWFrZUZvcmsgPSBmdW5jdGlvbihwcm9qZWN0KXtcblxuXHRcdFx0fVxuXHRcdHZhciBzdG9wID1mYWxzZTtcblxuXHRcdCRzY29wZS5zYW1wbGVUcmFjayA9IGZ1bmN0aW9uKHRyYWNrKXtcblxuXHRcdFx0aWYoc3RvcD09PXRydWUpe1xuXHRcdFx0XHQkc2NvcGUucGxheWVyLnN0b3AoKVxuXHRcdFx0fVxuXG5cdFx0XHRUb25lVHJhY2tGY3QuY3JlYXRlUGxheWVyKHRyYWNrLnVybCwgZnVuY3Rpb24ocGxheWVyKXtcblx0XHRcdFx0JHNjb3BlLnBsYXllciA9IHBsYXllcjtcblx0XHRcdFx0aWYoc3RvcD09PWZhbHNlKXtcblx0XHRcdFx0XHRzdG9wPXRydWVcblx0XHRcdFx0XHQkc2NvcGUucGxheWVyLnN0YXJ0KCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZXtcblx0XHRcdFx0XHRzdG9wPWZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdH1cblxuXG5cdCAgJHNjb3BlLmdldFVzZXJQcm9maWxlID0gZnVuY3Rpb24odXNlcil7XG5cdCAgICBjb25zb2xlLmxvZyhcImNsaWNrZWRcIiwgdXNlcik7XG5cdCAgICAkc3RhdGUuZ28oJ3VzZXJQcm9maWxlJywge3RoZUlEOiB1c2VyLl9pZH0pO1xuXHR9XG5cbiAgICBcblxuXG59KTtcblxuIiwiYXBwLmNvbnRyb2xsZXIoJ05ld1Byb2plY3RDb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCBBdXRoU2VydmljZSwgUHJvamVjdEZjdCwgJHN0YXRlKXtcblx0JHNjb3BlLnVzZXI7XG5cblx0IEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24odXNlcil7XG5cdCBcdCRzY29wZS51c2VyID0gdXNlcjtcbiAgICAgICAgY29uc29sZS5sb2coJ3VzZXIgaXMnLCAkc2NvcGUudXNlci51c2VybmFtZSlcbiAgICB9KTtcblxuXHQgJHNjb3BlLm5ld1Byb2plY3RCdXQgPSBmdW5jdGlvbigpe1xuXHQgXHRQcm9qZWN0RmN0Lm5ld1Byb2plY3QoJHNjb3BlLnVzZXIpLnRoZW4oZnVuY3Rpb24ocHJvamVjdElkKXtcblx0IFx0XHRjb25zb2xlLmxvZygnU3VjY2VzcyBpcycsIHByb2plY3RJZClcblx0XHRcdCRzdGF0ZS5nbygncHJvamVjdCcsIHtwcm9qZWN0SUQ6IHByb2plY3RJZH0pO1x0IFx0XG5cdFx0fSlcblxuXHQgfVxuXG59KSIsImFwcC5jb250cm9sbGVyKCdUaW1lbGluZUNvbnRyb2xsZXInLCBmdW5jdGlvbiAoJHNjb3BlLCAkc3RhdGVQYXJhbXMsICRsb2NhbFN0b3JhZ2UsIFJlY29yZGVyRmN0LCBQcm9qZWN0RmN0LCBUb25lVHJhY2tGY3QsIFRvbmVUaW1lbGluZUZjdCkge1xuICBcbiAgdmFyIHdhdkFycmF5ID0gW107XG4gIFxuICAkc2NvcGUubnVtTWVhc3VyZXMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCA2MDsgaSsrKSB7XG4gICAgJHNjb3BlLm51bU1lYXN1cmVzLnB1c2goaSk7XG4gIH1cblxuICAkc2NvcGUubWVhc3VyZUxlbmd0aCA9IDE7XG4gICRzY29wZS50cmFja3MgPSBbXTtcbiAgJHNjb3BlLmxvYWRpbmcgPSB0cnVlO1xuXG5cbiAgUHJvamVjdEZjdC5nZXRQcm9qZWN0SW5mbygnNTU5NGMyMGFkMDc1OWNkNDBjZTUxZTE0JykudGhlbihmdW5jdGlvbiAocHJvamVjdCkge1xuXG4gICAgICB2YXIgbG9hZGVkID0gMDtcbiAgICAgIGNvbnNvbGUubG9nKCdQUk9KRUNUJywgcHJvamVjdCk7XG5cbiAgICAgIGlmIChwcm9qZWN0LnRyYWNrcy5sZW5ndGgpIHtcbiAgICAgICAgcHJvamVjdC50cmFja3MuZm9yRWFjaChmdW5jdGlvbiAodHJhY2spIHtcbiAgICAgICAgICAgIHZhciBkb25lTG9hZGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBsb2FkZWQrKztcbiAgICAgICAgICAgICAgICBpZihsb2FkZWQgPT09IHByb2plY3QudHJhY2tzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAkc2NvcGUubG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAvLyBUb25lLlRyYW5zcG9ydC5zdGFydCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0cmFjay5wbGF5ZXIgPSBUb25lVHJhY2tGY3QuY3JlYXRlUGxheWVyKHRyYWNrLnVybCwgZG9uZUxvYWRpbmcpO1xuICAgICAgICAgICAgVG9uZVRpbWVsaW5lRmN0LmFkZExvb3BUb1RpbWVsaW5lKHRyYWNrLnBsYXllciwgdHJhY2subG9jYXRpb24pO1xuICAgICAgICAgICAgJHNjb3BlLnRyYWNrcy5wdXNoKHRyYWNrKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDY7IGkrKykge1xuICAgICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgICBvYmoubmFtZSA9ICdUcmFjayAnICsgKGkrMSk7XG4gICAgICAgICAgb2JqLmxvY2F0aW9uID0gW107XG4gICAgICAgICAgJHNjb3BlLnRyYWNrcy5wdXNoKG9iaik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgVG9uZVRpbWVsaW5lRmN0LmdldFRyYW5zcG9ydChwcm9qZWN0LmVuZE1lYXN1cmUpO1xuICAgICAgVG9uZVRpbWVsaW5lRmN0LmNoYW5nZUJwbShwcm9qZWN0LmJwbSk7XG5cbiAgfSk7XG5cbiAgLy8gQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbihhVXNlcil7XG4gIC8vICAgICAkc2NvcGUudGhlVXNlciA9IGFVc2VyO1xuICAvLyAgICAgLy8gJHN0YXRlUGFyYW1zLnRoZUlEID0gYVVzZXIuX2lkXG4gIC8vICAgICBjb25zb2xlLmxvZyhcImlkXCIsICRzdGF0ZVBhcmFtcyk7XG4gIC8vIH0pO1xuXG4gICRzY29wZS5yZWNvcmQgPSBmdW5jdGlvbiAoZSwgaW5kZXgpIHtcblxuICBcdGUgPSBlLnRvRWxlbWVudDtcblxuICAgICAgICAvLyBzdGFydCByZWNvcmRpbmdcbiAgICAgICAgY29uc29sZS5sb2coJ3N0YXJ0IHJlY29yZGluZycpO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFhdWRpb1JlY29yZGVyKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGUuY2xhc3NMaXN0LmFkZChcInJlY29yZGluZ1wiKTtcbiAgICAgICAgYXVkaW9SZWNvcmRlci5jbGVhcigpO1xuICAgICAgICBhdWRpb1JlY29yZGVyLnJlY29yZCgpO1xuXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGF1ZGlvUmVjb3JkZXIuc3RvcCgpO1xuICAgICAgICAgIGUuY2xhc3NMaXN0LnJlbW92ZShcInJlY29yZGluZ1wiKTtcbiAgICAgICAgICBhdWRpb1JlY29yZGVyLmdldEJ1ZmZlcnMoIGdvdEJ1ZmZlcnMgKTtcbiAgICAgICAgICBcbiAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkc2NvcGUudHJhY2tzW2luZGV4XS5yYXdBdWRpbyA9IHdpbmRvdy5sYXRlc3RSZWNvcmRpbmc7XG4gICAgICAgICAgICAvLyAkc2NvcGUudHJhY2tzW2luZGV4XS5yYXdJbWFnZSA9IHdpbmRvdy5sYXRlc3RSZWNvcmRpbmdJbWFnZTtcblxuICAgICAgICAgIH0sIDUwMCk7XG4gICAgICAgICAgXG4gICAgICAgIH0sIDIwMDApO1xuXG4gIH1cblxuICAkc2NvcGUuYWRkVHJhY2sgPSBmdW5jdGlvbiAoKSB7XG5cbiAgfTtcblxuICAkc2NvcGUuc2VuZFRvQVdTID0gZnVuY3Rpb24gKCkge1xuXG4gICAgICAgdmFyIGF3c1RyYWNrcyA9ICRzY29wZS50cmFja3MuZmlsdGVyKGZ1bmN0aW9uKHRyYWNrLGluZGV4KXtcbiAgICAgICAgICAgICAgaWYodHJhY2sucmF3QXVkaW8pe1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgIFJlY29yZGVyRmN0LnNlbmRUb0FXUyhhd3NUcmFja3MsICc1NTk1YTdmYWFhOTAxYWQ2MzIzNGY5MjAnKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAvLyB3YXZlIGxvZ2ljXG4gICAgICAgIGNvbnNvbGUubG9nKCdyZXNwb25zZSBmcm9tIHNlbmRUb0FXUycsIHJlc3BvbnNlKTtcblxuICAgIH0pO1xuICB9O1xuXG5cblx0XG5cblxufSk7XG5cblxuIiwiXG5hcHAuY29udHJvbGxlcignVXNlckNvbnRyb2xsZXInLCBmdW5jdGlvbiAoJHNjb3BlLCAkc3RhdGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGVQYXJhbXMsIHVzZXJGYWN0b3J5KSB7XG5cbiAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uKGxvZ2dlZEluVXNlcil7XG4gICAgICAgIGNvbnNvbGUubG9nKCdnZXR0aW5nJylcbiAgICAgICAgXG4gICAgICAgICAgJHNjb3BlLmxvZ2dlZEluVXNlciA9IGxvZ2dlZEluVXNlcjtcblxuICAgICAgICAgIHVzZXJGYWN0b3J5LmdldFVzZXJPYmooJHN0YXRlUGFyYW1zLnRoZUlEKS50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAgICAgJHNjb3BlLnVzZXIgPSB1c2VyO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3VzZXIgaXMnLCB1c2VyKVxuICAgICAgICAgIH0pXG4gICAgICAgIFxuXG4gICAgfSk7XG5cbiAgICAkc2NvcGUuZGlzcGxheVNldHRpbmdzID0gZnVuY3Rpb24oKXtcbiAgICAgICAgaWYoJHNjb3BlLnNob3dTZXR0aW5ncykgJHNjb3BlLnNob3dTZXR0aW5ncyA9IGZhbHNlO1xuICAgICAgICBlbHNlICRzY29wZS5zaG93U2V0dGluZ3MgPSB0cnVlO1xuICAgICAgICBjb25zb2xlLmxvZygkc2NvcGUuc2hvd1NldHRpbmdzKTtcbiAgICB9XG5cbiAgICAkc2NvcGUuZm9sbG93ID0gZnVuY3Rpb24odXNlcil7XG4gICAgICB1c2VyRmFjdG9yeS5mb2xsb3codXNlciwgJHNjb3BlLmxvZ2dlZEluVXNlcikudGhlbihmdW5jdGlvbihyZXNwb25zZSl7XG4gICAgICAgIGNvbnNvbGUubG9nKCdGb2xsb3cgY29udHJvbGxlciByZXNwb25zZScsIHJlc3BvbnNlKTtcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgXG5cblxufSk7IiwiYXBwLmZhY3RvcnkoJ0FuYWx5c2VyRmN0JywgZnVuY3Rpb24oKSB7XG5cblx0dmFyIHVwZGF0ZUFuYWx5c2VycyA9IGZ1bmN0aW9uIChhbmFseXNlckNvbnRleHQsIGFuYWx5c2VyTm9kZSwgY29udGludWVVcGRhdGUpIHtcblxuXHRcdGZ1bmN0aW9uIHVwZGF0ZSgpIHtcblx0XHRcdHZhciBTUEFDSU5HID0gMztcblx0XHRcdHZhciBCQVJfV0lEVEggPSAxO1xuXHRcdFx0dmFyIG51bUJhcnMgPSBNYXRoLnJvdW5kKDMwMCAvIFNQQUNJTkcpO1xuXHRcdFx0dmFyIGZyZXFCeXRlRGF0YSA9IG5ldyBVaW50OEFycmF5KGFuYWx5c2VyTm9kZS5mcmVxdWVuY3lCaW5Db3VudCk7XG5cblx0XHRcdGFuYWx5c2VyTm9kZS5nZXRCeXRlRnJlcXVlbmN5RGF0YShmcmVxQnl0ZURhdGEpOyBcblxuXHRcdFx0YW5hbHlzZXJDb250ZXh0LmNsZWFyUmVjdCgwLCAwLCAzMDAsIDEwMCk7XG5cdFx0XHRhbmFseXNlckNvbnRleHQuZmlsbFN0eWxlID0gJyNGNkQ1NjUnO1xuXHRcdFx0YW5hbHlzZXJDb250ZXh0LmxpbmVDYXAgPSAncm91bmQnO1xuXHRcdFx0dmFyIG11bHRpcGxpZXIgPSBhbmFseXNlck5vZGUuZnJlcXVlbmN5QmluQ291bnQgLyBudW1CYXJzO1xuXG5cdFx0XHQvLyBEcmF3IHJlY3RhbmdsZSBmb3IgZWFjaCBmcmVxdWVuY3kgYmluLlxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBudW1CYXJzOyArK2kpIHtcblx0XHRcdFx0dmFyIG1hZ25pdHVkZSA9IDA7XG5cdFx0XHRcdHZhciBvZmZzZXQgPSBNYXRoLmZsb29yKCBpICogbXVsdGlwbGllciApO1xuXHRcdFx0XHQvLyBnb3R0YSBzdW0vYXZlcmFnZSB0aGUgYmxvY2ssIG9yIHdlIG1pc3MgbmFycm93LWJhbmR3aWR0aCBzcGlrZXNcblx0XHRcdFx0Zm9yICh2YXIgaiA9IDA7IGo8IG11bHRpcGxpZXI7IGorKylcblx0XHRcdFx0ICAgIG1hZ25pdHVkZSArPSBmcmVxQnl0ZURhdGFbb2Zmc2V0ICsgal07XG5cdFx0XHRcdG1hZ25pdHVkZSA9IG1hZ25pdHVkZSAvIG11bHRpcGxpZXI7XG5cdFx0XHRcdHZhciBtYWduaXR1ZGUyID0gZnJlcUJ5dGVEYXRhW2kgKiBtdWx0aXBsaWVyXTtcblx0XHRcdFx0YW5hbHlzZXJDb250ZXh0LmZpbGxTdHlsZSA9IFwiaHNsKCBcIiArIE1hdGgucm91bmQoKGkqMzYwKS9udW1CYXJzKSArIFwiLCAxMDAlLCA1MCUpXCI7XG5cdFx0XHRcdGFuYWx5c2VyQ29udGV4dC5maWxsUmVjdChpICogU1BBQ0lORywgMTAwLCBCQVJfV0lEVEgsIC1tYWduaXR1ZGUpO1xuXHRcdFx0fVxuXHRcdFx0aWYoY29udGludWVVcGRhdGUpIHtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggdXBkYXRlICk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIHVwZGF0ZSApO1xuXHR9XG5cblxuXHR2YXIgY2FuY2VsQW5hbHlzZXJVcGRhdGVzID0gZnVuY3Rpb24gKGFuYWx5c2VySWQpIHtcblx0XHR3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoIGFuYWx5c2VySWQgKTtcblx0fVxuXHRyZXR1cm4ge1xuXHRcdHVwZGF0ZUFuYWx5c2VyczogdXBkYXRlQW5hbHlzZXJzLFxuXHRcdGNhbmNlbEFuYWx5c2VyVXBkYXRlczogY2FuY2VsQW5hbHlzZXJVcGRhdGVzXG5cdH1cbn0pOyIsIid1c2Ugc3RyaWN0JztcbmFwcC5mYWN0b3J5KCdIb21lRmN0JywgZnVuY3Rpb24oJGh0dHApe1xuXG5cbiAgICByZXR1cm4ge1xuICAgICAgICBnZXRVc2VyOiBmdW5jdGlvbih1c2VyKXtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9hcGkvdXNlcicsIHtwYXJhbXM6IHtfaWQ6IHVzZXJ9fSlcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHN1Y2Nlc3Mpe1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzLmRhdGE7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbn0pOyIsIid1c2Ugc3RyaWN0JztcbmFwcC5mYWN0b3J5KCdQcm9qZWN0RmN0JywgZnVuY3Rpb24oJGh0dHApe1xuXG4gICAgdmFyIGdldFByb2plY3RJbmZvID0gZnVuY3Rpb24gKHByb2plY3RJZCkge1xuXG4gICAgICAgIC8vaWYgY29taW5nIGZyb20gSG9tZUNvbnRyb2xsZXIgYW5kIG5vIElkIGlzIHBhc3NlZCwgc2V0IGl0IHRvICdhbGwnXG4gICAgICAgIHZhciBwcm9qZWN0aWQ9IHByb2plY3RJZCB8fCAnYWxsJ1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3Byb2plY3RzLycgKyBwcm9qZWN0aWQgfHwgcHJvamVjdGlkKS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKXtcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgdmFyIGNyZWF0ZUFGb3JrID0gZnVuY3Rpb24ocHJvamVjdCl7XG4gICAgXHRyZXR1cm4gJGh0dHAucG9zdCgnL2FwaS9wcm9qZWN0cy8nLCBwcm9qZWN0KS50aGVuKGZ1bmN0aW9uKGZvcmspe1xuICAgIFx0XHRyZXR1cm4gJGh0dHAucHV0KCdhcGkvdXNlcnMvJywgZm9yay5kYXRhKS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKXtcbiAgICBcdFx0XHRyZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgICBcdFx0fSk7XG4gICAgXHR9KTtcbiAgICB9XG4gICAgdmFyIG5ld1Byb2plY3QgPSBmdW5jdGlvbih1c2VyKXtcbiAgICBcdHJldHVybiAkaHR0cC5wb3N0KCcvYXBpL3Byb2plY3RzJyx7b3duZXI6dXNlci5faWQsIG5hbWU6J1VudGl0bGVkJywgYnBtOjEyMCwgZW5kTWVhc3VyZTogMzJ9KS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKXtcbiAgICBcdFx0cmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gICAgXHR9KVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGdldFByb2plY3RJbmZvOiBnZXRQcm9qZWN0SW5mbyxcbiAgICAgICAgY3JlYXRlQUZvcms6IGNyZWF0ZUFGb3JrLFxuICAgICAgICBuZXdQcm9qZWN0OiBuZXdQcm9qZWN0XG4gICAgfTtcblxufSk7XG4iLCIndXNlIHN0cmljdCc7XG5hcHAuZmFjdG9yeSgnUmFuZG9tR3JlZXRpbmdzJywgZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIGdldFJhbmRvbUZyb21BcnJheSA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgcmV0dXJuIGFycltNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKV07XG4gICAgfTtcblxuICAgIHZhciBncmVldGluZ3MgPSBbXG4gICAgICAgICdIZWxsbywgd29ybGQhJyxcbiAgICAgICAgJ0F0IGxvbmcgbGFzdCwgSSBsaXZlIScsXG4gICAgICAgICdIZWxsbywgc2ltcGxlIGh1bWFuLicsXG4gICAgICAgICdXaGF0IGEgYmVhdXRpZnVsIGRheSEnLFxuICAgICAgICAnSVxcJ20gbGlrZSBhbnkgb3RoZXIgcHJvamVjdCwgZXhjZXB0IHRoYXQgSSBhbSB5b3Vycy4gOiknLFxuICAgICAgICAnVGhpcyBlbXB0eSBzdHJpbmcgaXMgZm9yIExpbmRzYXkgTGV2aW5lLicsXG4gICAgICAgICfjgZPjgpPjgavjgaHjga/jgIHjg6bjg7zjgrbjg7zmp5jjgIInLFxuICAgICAgICAnV2VsY29tZS4gVG8uIFdFQlNJVEUuJyxcbiAgICAgICAgJzpEJ1xuICAgIF07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBncmVldGluZ3M6IGdyZWV0aW5ncyxcbiAgICAgICAgZ2V0UmFuZG9tR3JlZXRpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRSYW5kb21Gcm9tQXJyYXkoZ3JlZXRpbmdzKTtcbiAgICAgICAgfVxuICAgIH07XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ1JlY29yZGVyRmN0JywgZnVuY3Rpb24gKCRodHRwLCBBdXRoU2VydmljZSwgJHEsIFRvbmVUcmFja0ZjdCwgQW5hbHlzZXJGY3QpIHtcblxuICAgIHZhciByZWNvcmRlckluaXQgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgcmV0dXJuICRxKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHZhciBDb250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xuICAgICAgICAgICAgdmFyIGF1ZGlvQ29udGV4dCA9IG5ldyBDb250ZXh0KCk7XG4gICAgICAgICAgICB2YXIgcmVjb3JkZXI7XG5cbiAgICAgICAgICAgIHZhciBuYXZpZ2F0b3IgPSB3aW5kb3cubmF2aWdhdG9yO1xuICAgICAgICAgICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSA9IChcbiAgICAgICAgICAgICAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIHx8XG4gICAgICAgICAgICAgICAgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYSB8fFxuICAgICAgICAgICAgICAgIG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWEgfHxcbiAgICAgICAgICAgICAgICBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWFcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpZiAoIW5hdmlnYXRvci5jYW5jZWxBbmltYXRpb25GcmFtZSlcbiAgICAgICAgICAgICAgICBuYXZpZ2F0b3IuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBuYXZpZ2F0b3Iud2Via2l0Q2FuY2VsQW5pbWF0aW9uRnJhbWUgfHwgbmF2aWdhdG9yLm1vekNhbmNlbEFuaW1hdGlvbkZyYW1lO1xuICAgICAgICAgICAgaWYgKCFuYXZpZ2F0b3IucmVxdWVzdEFuaW1hdGlvbkZyYW1lKVxuICAgICAgICAgICAgICAgIG5hdmlnYXRvci5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBuYXZpZ2F0b3Iud2Via2l0UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8IG5hdmlnYXRvci5tb3pSZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XG5cbiAgICAgICAgICAgIC8vIGFzayBmb3IgcGVybWlzc2lvblxuICAgICAgICAgICAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYShcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJhdWRpb1wiOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJtYW5kYXRvcnlcIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImdvb2dFY2hvQ2FuY2VsbGF0aW9uXCI6IFwiZmFsc2VcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJnb29nQXV0b0dhaW5Db250cm9sXCI6IFwiZmFsc2VcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJnb29nTm9pc2VTdXBwcmVzc2lvblwiOiBcImZhbHNlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZ29vZ0hpZ2hwYXNzRmlsdGVyXCI6IFwiZmFsc2VcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJvcHRpb25hbFwiOiBbXVxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKHN0cmVhbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGlucHV0UG9pbnQgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgYW4gQXVkaW9Ob2RlIGZyb20gdGhlIHN0cmVhbS5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWFsQXVkaW9JbnB1dCA9IGF1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGF1ZGlvSW5wdXQgPSByZWFsQXVkaW9JbnB1dDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvSW5wdXQuY29ubmVjdChpbnB1dFBvaW50KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIGFuYWx5c2VyIG5vZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhbmFseXNlck5vZGUgPSBhdWRpb0NvbnRleHQuY3JlYXRlQW5hbHlzZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFuYWx5c2VyTm9kZS5mZnRTaXplID0gMjA0ODtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0UG9pbnQuY29ubmVjdCggYW5hbHlzZXJOb2RlICk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY3JlYXRlIHJlY29yZGVyXG4gICAgICAgICAgICAgICAgICAgICAgICByZWNvcmRlciA9IG5ldyBSZWNvcmRlciggaW5wdXRQb2ludCApO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHplcm9HYWluID0gYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHplcm9HYWluLmdhaW4udmFsdWUgPSAwLjA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFBvaW50LmNvbm5lY3QoIHplcm9HYWluICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB6ZXJvR2Fpbi5jb25uZWN0KCBhdWRpb0NvbnRleHQuZGVzdGluYXRpb24gKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShbcmVjb3JkZXIsIGFuYWx5c2VyTm9kZV0pO1xuXG4gICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbGVydCgnRXJyb3IgZ2V0dGluZyBhdWRpbycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB2YXIgcmVjb3JkU3RhcnQgPSBmdW5jdGlvbiAocmVjb3JkZXIpIHtcbiAgICAgICAgcmVjb3JkZXIuY2xlYXIoKTtcbiAgICAgICAgcmVjb3JkZXIucmVjb3JkKCk7XG4gICAgfVxuXG4gICAgdmFyIHJlY29yZFN0b3AgPSBmdW5jdGlvbiAoaW5kZXgsIHJlY29yZGVyKSB7XG4gICAgICAgIHJlY29yZGVyLnN0b3AoKTtcbiAgICAgICAgcmV0dXJuIG5ldyAkcShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAvLyBlLmNsYXNzTGlzdC5yZW1vdmUoXCJyZWNvcmRpbmdcIik7XG4gICAgICAgICAgICByZWNvcmRlci5nZXRCdWZmZXJzKGZ1bmN0aW9uIChidWZmZXJzKSB7XG4gICAgICAgICAgICAgICAgLy9kaXNwbGF5IHdhdiBpbWFnZVxuICAgICAgICAgICAgICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggXCJ3YXZlZGlzcGxheVwiICsgIGluZGV4ICk7XG4gICAgICAgICAgICAgICAgZHJhd0J1ZmZlciggMzAwLCAxMDAsIGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpLCBidWZmZXJzWzBdICk7XG4gICAgICAgICAgICAgICAgd2luZG93LmxhdGVzdEJ1ZmZlciA9IGJ1ZmZlcnNbMF07XG4gICAgICAgICAgICAgICAgd2luZG93LmxhdGVzdFJlY29yZGluZ0ltYWdlID0gY2FudmFzLnRvRGF0YVVSTChcImltYWdlL3BuZ1wiKTtcblxuICAgICAgICAgICAgICAgIC8vIHRoZSBPTkxZIHRpbWUgZ290QnVmZmVycyBpcyBjYWxsZWQgaXMgcmlnaHQgYWZ0ZXIgYSBuZXcgcmVjb3JkaW5nIGlzIGNvbXBsZXRlZCAtIFxuICAgICAgICAgICAgICAgIC8vIHNvIGhlcmUncyB3aGVyZSB3ZSBzaG91bGQgc2V0IHVwIHRoZSBkb3dubG9hZC5cbiAgICAgICAgICAgICAgICByZWNvcmRlci5leHBvcnRXQVYoIGZ1bmN0aW9uICggYmxvYiApIHtcbiAgICAgICAgICAgICAgICAgICAgLy9uZWVkcyBhIHVuaXF1ZSBuYW1lXG4gICAgICAgICAgICAgICAgICAgIC8vIFJlY29yZGVyLnNldHVwRG93bmxvYWQoIGJsb2IsIFwibXlSZWNvcmRpbmcwLndhdlwiICk7XG4gICAgICAgICAgICAgICAgICAgIC8vY3JlYXRlIGxvb3AgdGltZVxuICAgICAgICAgICAgICAgICAgICBUb25lVHJhY2tGY3QubG9vcEluaXRpYWxpemUoYmxvYiwgaW5kZXgsIFwibXlSZWNvcmRpbmcwLndhdlwiKS50aGVuKHJlc29sdmUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG5cbiAgICBcbiAgICB2YXIgY29udmVydFRvQmFzZTY0ID0gZnVuY3Rpb24gKHRyYWNrKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdlYWNoIHRyYWNrJywgdHJhY2spO1xuICAgICAgICByZXR1cm4gbmV3ICRxKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuXG4gICAgICAgICAgICBpZih0cmFjay5yYXdBdWRpbykge1xuICAgICAgICAgICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKHRyYWNrLnJhd0F1ZGlvKTtcbiAgICAgICAgICAgICAgICByZWFkZXIub25sb2FkZW5kID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuXG5cblxuICAgIHJldHVybiB7XG4gICAgICAgIHNlbmRUb0FXUzogZnVuY3Rpb24gKHRyYWNrc0FycmF5LCBwcm9qZWN0SWQpIHtcblxuICAgICAgICAgICAgdmFyIHJlYWRQcm9taXNlcyA9IHRyYWNrc0FycmF5Lm1hcChjb252ZXJ0VG9CYXNlNjQpO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZygncmVhZFByb21pc2VzJywgcmVhZFByb21pc2VzKTtcblxuICAgICAgICAgICAgcmV0dXJuICRxLmFsbChyZWFkUHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24gKHN0b3JlRGF0YSkge1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzdG9yZURhdGEnLCBzdG9yZURhdGEpO1xuXG4gICAgICAgICAgICAgICAgdHJhY2tzQXJyYXkuZm9yRWFjaChmdW5jdGlvbiAodHJhY2ssIGkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0b3JlRGF0YVtpXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhY2sucmF3QXVkaW8gPSBzdG9yZURhdGFbaV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCd0cmFja3NBcnJheScsIHRyYWNrc0FycmF5KTtcblxuICAgICAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvYXBpL2F3cy8nLCB7IHRyYWNrcyA6IHRyYWNrc0FycmF5LCBwcm9qZWN0SWQgOiBwcm9qZWN0SWQgfSlcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygncmVzcG9uc2UgaW4gc2VuZFRvQVdTRmFjdG9yeScsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5kYXRhOyBcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgIH0sXG4gICAgICAgIHJlY29yZGVySW5pdDogcmVjb3JkZXJJbml0LFxuICAgICAgICByZWNvcmRTdGFydDogcmVjb3JkU3RhcnQsXG4gICAgICAgIHJlY29yZFN0b3A6IHJlY29yZFN0b3BcbiAgICB9XG59KTsiLCIndXNlIHN0cmljdCc7XG4iLCIndXNlIHN0cmljdCc7XG5hcHAuZmFjdG9yeSgnVG9uZVRpbWVsaW5lRmN0JywgZnVuY3Rpb24gKCRodHRwLCAkcSkge1xuXG5cdHZhciBjcmVhdGVUcmFuc3BvcnQgPSBmdW5jdGlvbiAobG9vcEVuZCkge1xuICAgICAgICByZXR1cm4gbmV3ICRxKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRcdFRvbmUuVHJhbnNwb3J0Lmxvb3AgPSB0cnVlO1xuXHRcdFx0VG9uZS5UcmFuc3BvcnQubG9vcFN0YXJ0ID0gJzBtJztcblx0XHRcdFRvbmUuVHJhbnNwb3J0Lmxvb3BFbmQgPSBsb29wRW5kLnRvU3RyaW5nKCkgKyAnbSc7XG5cdFx0XHR2YXIgcGxheUhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWJhY2tIZWFkJyk7XG5cblx0XHRcdGNyZWF0ZU1ldHJvbm9tZSgpLnRoZW4oZnVuY3Rpb24gKG1ldHJvbm9tZSkge1xuXHRcdFx0XHRUb25lLlRyYW5zcG9ydC5zZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0dmFyIHBvc0FyciA9IFRvbmUuVHJhbnNwb3J0LnBvc2l0aW9uLnNwbGl0KCc6Jyk7XG5cdFx0XHRcdFx0dmFyIGxlZnRQb3MgPSAoKHBhcnNlSW50KHBvc0FyclswXSkgKiAyMDAgKSArIChwYXJzZUludChwb3NBcnJbMV0pICogNTApICsgNTAwKS50b1N0cmluZygpICsgJ3B4Jztcblx0XHRcdFx0XHRwbGF5SGVhZC5zdHlsZS5sZWZ0ID0gbGVmdFBvcztcblx0XHRcdFx0XHRtZXRyb25vbWUuc3RhcnQoKTtcblx0XHRcdFx0fSwgJzFtJyk7XG5cdFx0XHRcdFRvbmUuVHJhbnNwb3J0LnNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhUb25lLlRyYW5zcG9ydC5wb3NpdGlvbik7XG5cdFx0XHRcdFx0bWV0cm9ub21lLnN0YXJ0KCk7XG5cdFx0XHRcdH0sICc0bicpO1xuXHRcdFx0XHRyZXR1cm4gcmVzb2x2ZShtZXRyb25vbWUpO1xuXHRcdFx0fSk7XG4gICAgICAgIH0pO1xuXHR9O1xuXG5cdHZhciBjaGFuZ2VCcG0gPSBmdW5jdGlvbiAoYnBtKSB7XG5cdFx0VG9uZS5UcmFuc3BvcnQuYnBtLnZhbHVlID0gYnBtO1xuXHRcdHJldHVybiBUb25lLlRyYW5zcG9ydDtcblx0fTtcblxuXHR2YXIgc3RvcEFsbCA9IGZ1bmN0aW9uICh0cmFja3MpIHtcblx0XHR0cmFja3MuZm9yRWFjaChmdW5jdGlvbiAodHJhY2spIHtcblx0XHRcdGlmKHRyYWNrLnBsYXllcikgdHJhY2sucGxheWVyLnN0b3AoKTtcblx0XHR9KTtcblx0fTtcblxuXHR2YXIgbXV0ZUFsbCA9IGZ1bmN0aW9uICh0cmFja3MpIHtcblx0XHR0cmFja3MuZm9yRWFjaChmdW5jdGlvbiAodHJhY2spIHtcblx0XHRcdGlmKHRyYWNrLnBsYXllcikgdHJhY2sucGxheWVyLnZvbHVtZS52YWx1ZSA9IC0xMDA7XG5cdFx0fSk7XG5cdH07XG5cblx0dmFyIHVuTXV0ZUFsbCA9IGZ1bmN0aW9uICh0cmFja3MpIHtcblx0XHR0cmFja3MuZm9yRWFjaChmdW5jdGlvbiAodHJhY2spIHtcblx0XHRcdGlmKHRyYWNrLnBsYXllcikgdHJhY2sucGxheWVyLnZvbHVtZS52YWx1ZSA9IDA7XG5cdFx0fSk7XG5cdH07XG5cblx0dmFyIGNyZWF0ZU1ldHJvbm9tZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyAkcShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdCAgICAgICAgdmFyIG1ldCA9IG5ldyBUb25lLlBsYXllcihcIi9hcGkvd2F2L0NsaWNrMS53YXZcIiwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gcmVzb2x2ZShtZXQpO1xuXHQgICAgICAgIH0pLnRvTWFzdGVyKCk7XG4gICAgICAgIH0pO1xuXHR9O1xuXG5cdHZhciBhZGRMb29wVG9UaW1lbGluZSA9IGZ1bmN0aW9uIChwbGF5ZXIsIHN0YXJ0VGltZUFycmF5KSB7XG5cblx0XHRpZihzdGFydFRpbWVBcnJheS5pbmRleE9mKDApID09PSAtMSkge1xuXHRcdFx0VG9uZS5UcmFuc3BvcnQuc2V0VGltZWxpbmUoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHBsYXllci5zdG9wKCk7XG5cdFx0XHR9LCBcIjBtXCIpXG5cblx0XHR9XG5cblx0XHRzdGFydFRpbWVBcnJheS5mb3JFYWNoKGZ1bmN0aW9uIChzdGFydFRpbWUpIHtcblxuXHRcdFx0dmFyIHN0YXJ0VGltZSA9IHN0YXJ0VGltZS50b1N0cmluZygpICsgJ20nO1xuXG5cdFx0XHRUb25lLlRyYW5zcG9ydC5zZXRUaW1lbGluZShmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdTdGFydCcsIFRvbmUuVHJhbnNwb3J0LnBvc2l0aW9uKTtcblx0XHRcdFx0cGxheWVyLnN0b3AoKTtcblx0XHRcdFx0cGxheWVyLnN0YXJ0KCk7XG5cdFx0XHR9LCBzdGFydFRpbWUpO1xuXG5cdFx0XHQvLyB2YXIgc3RvcFRpbWUgPSBwYXJzZUludChzdGFydFRpbWUuc3Vic3RyKDAsIHN0YXJ0VGltZS5sZW5ndGgtMSkpICsgMSkudG9TdHJpbmcoKSArIHN0YXJ0VGltZS5zdWJzdHIoLTEsMSk7XG5cdFx0XHQvLy8vIGNvbnNvbGUubG9nKCdTVE9QJywgc3RvcCk7XG5cdFx0XHQvLy8vIHRyYW5zcG9ydC5zZXRUaW1lbGluZShmdW5jdGlvbiAoKSB7XG5cdFx0XHQvLy8vIFx0cGxheWVyLnN0b3AoKTtcblx0XHRcdC8vLy8gfSwgc3RvcFRpbWUpO1xuXG5cdFx0fSk7XG5cblx0fTtcblx0XG4gICAgcmV0dXJuIHtcbiAgICAgICAgY3JlYXRlVHJhbnNwb3J0OiBjcmVhdGVUcmFuc3BvcnQsXG4gICAgICAgIGNoYW5nZUJwbTogY2hhbmdlQnBtLFxuICAgICAgICBhZGRMb29wVG9UaW1lbGluZTogYWRkTG9vcFRvVGltZWxpbmUsXG4gICAgICAgIGNyZWF0ZU1ldHJvbm9tZTogY3JlYXRlTWV0cm9ub21lLFxuICAgICAgICBzdG9wQWxsOiBzdG9wQWxsLFxuICAgICAgICBtdXRlQWxsOiBtdXRlQWxsLFxuICAgICAgICB1bk11dGVBbGw6IHVuTXV0ZUFsbFxuICAgIH07XG5cbn0pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuYXBwLmZhY3RvcnkoJ1RvbmVUcmFja0ZjdCcsIGZ1bmN0aW9uICgkaHR0cCwgJHEpIHtcblxuXHR2YXIgY3JlYXRlUGxheWVyID0gZnVuY3Rpb24gKHVybCwgZG9uZUZuKSB7XG5cdFx0dmFyIHBsYXllciAgPSBuZXcgVG9uZS5QbGF5ZXIodXJsLCBkb25lRm4pO1xuXHRcdC8vIFRPRE86IHJlbW92ZSB0b01hc3RlclxuXHRcdHBsYXllci50b01hc3RlcigpO1xuXHRcdC8vIHBsYXllci5zeW5jKCk7XG5cdFx0Ly8gcGxheWVyLmxvb3AgPSB0cnVlO1xuXHRcdHJldHVybiBwbGF5ZXI7XG5cdH07XG5cblx0dmFyIGxvb3BJbml0aWFsaXplID0gZnVuY3Rpb24oYmxvYiwgaW5kZXgsIGZpbGVuYW1lKSB7XG5cdFx0cmV0dXJuIG5ldyAkcShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0XHQvL1BBU1NFRCBBIEJMT0IgRlJPTSBSRUNPUkRFUkpTRkFDVE9SWSAtIERST1BQRUQgT04gTUVBU1VSRSAwXG5cdFx0XHR2YXIgdXJsID0gKHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTCkuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuXHRcdFx0dmFyIGxpbmsgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInNhdmVcIitpbmRleCk7XG5cdFx0XHRsaW5rLmhyZWYgPSB1cmw7XG5cdFx0XHRsaW5rLmRvd25sb2FkID0gZmlsZW5hbWUgfHwgJ291dHB1dCcraW5kZXgrJy53YXYnO1xuXHRcdFx0d2luZG93LmxhdGVzdFJlY29yZGluZyA9IGJsb2I7XG5cdFx0XHR3aW5kb3cubGF0ZXN0UmVjb3JkaW5nVVJMID0gdXJsO1xuXHRcdFx0dmFyIHBsYXllcjtcblx0XHRcdC8vIFRPRE86IHJlbW92ZSB0b01hc3RlclxuXHRcdFx0cGxheWVyID0gbmV3IFRvbmUuUGxheWVyKGxpbmsuaHJlZiwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXNvbHZlKHBsYXllcik7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fTtcblxuXHR2YXIgZWZmZWN0c0luaXRpYWxpemUgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgY2hvcnVzID0gbmV3IFRvbmUuQ2hvcnVzKCk7XG5cdFx0dmFyIHBoYXNlciA9IG5ldyBUb25lLlBoYXNlcigpO1xuXHRcdHZhciBkaXN0b3J0ID0gbmV3IFRvbmUuRGlzdG9ydGlvbigpO1xuXHRcdHZhciBwaW5ncG9uZyA9IG5ldyBUb25lLlBpbmdQb25nRGVsYXkoKTtcblx0XHRjaG9ydXMud2V0LnZhbHVlID0gMDtcblx0XHRwaGFzZXIud2V0LnZhbHVlID0gMDtcblx0XHRkaXN0b3J0LndldC52YWx1ZSA9IDA7XG5cdFx0cGluZ3Bvbmcud2V0LnZhbHVlID0gMDtcblx0XHRjaG9ydXMuY29ubmVjdChwaGFzZXIpO1xuXHRcdHBoYXNlci5jb25uZWN0KGRpc3RvcnQpO1xuXHRcdGRpc3RvcnQuY29ubmVjdChwaW5ncG9uZyk7XG5cdFx0cGluZ3BvbmcudG9NYXN0ZXIoKTtcblxuXHRcdHJldHVybiBbY2hvcnVzLCBwaGFzZXIsIGRpc3RvcnQsIHBpbmdwb25nXTtcblx0fTtcblxuXHR2YXIgY3JlYXRlVGltZWxpbmVJbnN0YW5jZU9mTG9vcCA9IGZ1bmN0aW9uKHBsYXllciwgbWVhc3VyZSkge1xuXHRcdHJldHVybiBUb25lLlRyYW5zcG9ydC5zZXRUaW1lbGluZShmdW5jdGlvbigpIHtcblx0XHRcdFx0cGxheWVyLnN0b3AoKTtcblx0XHRcdFx0cGxheWVyLnN0YXJ0KCk7XG5cdFx0XHR9LCBtZWFzdXJlK1wibVwiKTtcblx0fTtcblxuXHR2YXIgcmVwbGFjZVRpbWVsaW5lTG9vcCA9IGZ1bmN0aW9uKHBsYXllciwgb2xkVGltZWxpbmVJZCwgbmV3TWVhc3VyZSkge1xuXHRcdHJldHVybiBuZXcgJHEoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdFx0Y29uc29sZS5sb2coJ29sZCB0aW1lbGluZSBpZCcsIG9sZFRpbWVsaW5lSWQpO1xuXHRcdFx0VG9uZS5UcmFuc3BvcnQuY2xlYXJUaW1lbGluZShwYXJzZUludChvbGRUaW1lbGluZUlkKSk7XG5cdFx0XHQvLyBUb25lLlRyYW5zcG9ydC5jbGVhclRpbWVsaW5lcygpO1xuXHRcdFx0cmVzb2x2ZShjcmVhdGVUaW1lbGluZUluc3RhbmNlT2ZMb29wKHBsYXllciwgbmV3TWVhc3VyZSkpO1xuXHRcdH0pO1xuXHR9O1xuXHR2YXIgZGVsZXRlVGltZWxpbmVMb29wID0gZnVuY3Rpb24odGltZWxpbmVJZCkge1xuXHRcdFRvbmUuVHJhbnNwb3J0LmNsZWFyVGltZWxpbmUocGFyc2VJbnQodGltZWxpbmVJZCkpO1xuXHR9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgY3JlYXRlUGxheWVyOiBjcmVhdGVQbGF5ZXIsXG4gICAgICAgIGxvb3BJbml0aWFsaXplOiBsb29wSW5pdGlhbGl6ZSxcbiAgICAgICAgZWZmZWN0c0luaXRpYWxpemU6IGVmZmVjdHNJbml0aWFsaXplLFxuICAgICAgICBjcmVhdGVUaW1lbGluZUluc3RhbmNlT2ZMb29wOiBjcmVhdGVUaW1lbGluZUluc3RhbmNlT2ZMb29wLFxuICAgICAgICByZXBsYWNlVGltZWxpbmVMb29wOiByZXBsYWNlVGltZWxpbmVMb29wLFxuICAgICAgICBkZWxldGVUaW1lbGluZUxvb3A6IGRlbGV0ZVRpbWVsaW5lTG9vcFxuICAgIH07XG5cbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ3VzZXJGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHApe1xuXHRyZXR1cm4ge1xuXHRcdGdldFVzZXJPYmo6IGZ1bmN0aW9uKHVzZXJJRCl7XG5cdFx0XHRyZXR1cm4gJGh0dHAuZ2V0KCdhcGkvdXNlcnMnLCB7cGFyYW1zOiB7X2lkOiB1c2VySUR9fSkudGhlbihmdW5jdGlvbihyZXNwb25zZSl7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdyZXNvb25zZSBpcycsIHJlc3BvbnNlLmRhdGEpXG5cdFx0XHRcdHJldHVybiByZXNwb25zZS5kYXRhO1xuXHRcdFx0fSk7XG5cdFx0fSxcblx0XHRmb2xsb3c6IGZ1bmN0aW9uKHVzZXIsIGxvZ2dlZEluVXNlcil7XG5cdFx0XHRyZXR1cm4gJGh0dHAucHV0KCdhcGkvdXNlcnMnLHt1c2VyVG9Gb2xsb3c6IHVzZXIsIGxvZ2dlZEluVXNlcjogbG9nZ2VkSW5Vc2VyfSkudGhlbihmdW5jdGlvbihyZXNwb25zZSl7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdGb2xsb3dVc2VyIEZhY3RvcnkgcmVzcG9uc2UnLCByZXNwb25zZS5kYXRhKTtcblx0XHRcdFx0cmV0dXJuIHJlc3BvbnNlLmRhdGE7XG5cdFx0XHR9KVxuXHRcdH1cblx0fVxuXG59KSIsImFwcC5kaXJlY3RpdmUoJ2RyYWdnYWJsZScsIGZ1bmN0aW9uKCkge1xuICByZXR1cm4gZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzKSB7XG4gICAgLy8gdGhpcyBnaXZlcyB1cyB0aGUgbmF0aXZlIEpTIG9iamVjdFxuICAgIHZhciBlbCA9IGVsZW1lbnRbMF07XG4gICAgXG4gICAgZWwuZHJhZ2dhYmxlID0gdHJ1ZTtcbiAgICBcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCBmdW5jdGlvbihlKSB7XG5cbiAgICAgICAgZS5kYXRhVHJhbnNmZXIuZWZmZWN0QWxsb3dlZCA9ICdtb3ZlJztcbiAgICAgICAgZS5kYXRhVHJhbnNmZXIuc2V0RGF0YSgnVGV4dCcsIHRoaXMuaWQpO1xuICAgICAgICB0aGlzLmNsYXNzTGlzdC5hZGQoJ2RyYWcnKTtcblxuICAgICAgICB2YXIgaWR4ID0gc2NvcGUudHJhY2subG9jYXRpb24uaW5kZXhPZihwYXJzZUludChhdHRycy5wb3NpdGlvbikpO1xuICAgICAgICBzY29wZS50cmFjay5sb2NhdGlvbi5zcGxpY2UoaWR4LCAxKTtcblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgZmFsc2VcbiAgICApO1xuICAgIFxuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIHRoaXMuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZycpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgZmFsc2VcbiAgICApO1xuXG4gIH1cbn0pO1xuXG5hcHAuZGlyZWN0aXZlKCdkcm9wcGFibGUnLCBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHtcbiAgICBzY29wZToge1xuICAgICAgZHJvcDogJyYnIC8vIHBhcmVudFxuICAgIH0sXG4gICAgbGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQpIHtcbiAgICAgIC8vIGFnYWluIHdlIG5lZWQgdGhlIG5hdGl2ZSBvYmplY3RcbiAgICAgIHZhciBlbCA9IGVsZW1lbnRbMF07XG4gICAgICBcbiAgICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgIGUuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnbW92ZSc7XG4gICAgICAgICAgLy8gYWxsb3dzIHVzIHRvIGRyb3BcbiAgICAgICAgICBpZiAoZS5wcmV2ZW50RGVmYXVsdCkgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIHRoaXMuY2xhc3NMaXN0LmFkZCgnb3ZlcicpO1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgZmFsc2VcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbnRlcicsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICB0aGlzLmNsYXNzTGlzdC5hZGQoJ292ZXInKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGZhbHNlXG4gICAgICApO1xuICAgICAgXG4gICAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgdGhpcy5jbGFzc0xpc3QucmVtb3ZlKCdvdmVyJyk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuICAgICAgICBmYWxzZVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAvLyBTdG9wcyBzb21lIGJyb3dzZXJzIGZyb20gcmVkaXJlY3RpbmcuXG4gICAgICAgICAgaWYgKGUuc3RvcFByb3BhZ2F0aW9uKSBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRoaXMuY2xhc3NMaXN0LnJlbW92ZSgnb3ZlcicpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIHVwb24gZHJvcCwgY2hhbmdpbmcgcG9zaXRpb24gYW5kIHVwZGF0aW5nIHRyYWNrLmxvY2F0aW9uIGFycmF5IG9uIHNjb3BlIFxuICAgICAgICAgIHZhciBpdGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZS5kYXRhVHJhbnNmZXIuZ2V0RGF0YSgnVGV4dCcpKTtcbiAgICAgICAgICB2YXIgeHBvc2l0aW9uID0gcGFyc2VJbnQodGhpcy5hdHRyaWJ1dGVzLnhwb3NpdGlvbi52YWx1ZSk7XG4gICAgICAgICAgdmFyIGNoaWxkTm9kZXMgPSB0aGlzLmNoaWxkTm9kZXM7XG4gICAgICAgICAgdmFyIG9sZFRpbWVsaW5lSWQ7XG4gICAgICAgICAgdmFyIHRoZUNhbnZhcztcblxuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBpZiAoY2hpbGROb2Rlc1tpXS5jbGFzc05hbWUgPT09ICdjYW52YXMtYm94Jykge1xuXG4gICAgICAgICAgICAgICAgICB0aGlzLmNoaWxkTm9kZXNbaV0uYXBwZW5kQ2hpbGQoaXRlbSk7XG4gICAgICAgICAgICAgICAgICBzY29wZS4kcGFyZW50LiRwYXJlbnQudHJhY2subG9jYXRpb24ucHVzaCh4cG9zaXRpb24pO1xuICAgICAgICAgICAgICAgICAgc2NvcGUuJHBhcmVudC4kcGFyZW50LnRyYWNrLmxvY2F0aW9uLnNvcnQoKTtcblxuICAgICAgICAgICAgICAgICAgdmFyIGNhbnZhc05vZGUgPSB0aGlzLmNoaWxkTm9kZXNbaV0uY2hpbGROb2RlcztcblxuICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBjYW52YXNOb2RlLmxlbmd0aDsgaisrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FudmFzTm9kZVtqXS5ub2RlTmFtZSA9PT0gJ0NBTlZBUycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2FudmFzTm9kZVtqXS5hdHRyaWJ1dGVzLnBvc2l0aW9uLnZhbHVlID0geHBvc2l0aW9uO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBvbGRUaW1lbGluZUlkID0gY2FudmFzTm9kZVtqXS5hdHRyaWJ1dGVzLnRpbWVsaW5laWQudmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoZUNhbnZhcyA9IGNhbnZhc05vZGVbal07XG5cbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gICAgIFxuICAgICAgICAgIH1cbiAgICAgICAgICBcblxuICAgICAgICAgIHNjb3BlLiRwYXJlbnQuJHBhcmVudC5tb3ZlSW5UaW1lbGluZShvbGRUaW1lbGluZUlkLCB4cG9zaXRpb24pLnRoZW4oZnVuY3Rpb24gKG5ld1RpbWVsaW5lSWQpIHtcbiAgICAgICAgICAgICAgdGhlQ2FudmFzLmF0dHJpYnV0ZXMudGltZWxpbmVpZC52YWx1ZSA9IG5ld1RpbWVsaW5lSWQ7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBjYWxsIHRoZSBkcm9wIHBhc3NlZCBkcm9wIGZ1bmN0aW9uXG4gICAgICAgICAgc2NvcGUuJGFwcGx5KCdkcm9wKCknKTtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIGZhbHNlXG4gICAgICApO1xuICAgIH1cbiAgfVxufSk7XG4iLCIndXNlIHN0cmljdCc7XG5hcHAuZGlyZWN0aXZlKCdmdWxsc3RhY2tMb2dvJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvZnVsbHN0YWNrLWxvZ28vZnVsbHN0YWNrLWxvZ28uaHRtbCdcbiAgICB9O1xufSk7IiwiYXBwLmRpcmVjdGl2ZSgncHJvamVjdGRpcmVjdGl2ZScsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRScsXG5cdFx0dGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9wcm9qZWN0L3Byb2plY3REaXJlY3RpdmUuaHRtbCcsXG5cdFx0Y29udHJvbGxlcjogJ3Byb2plY3RkaXJlY3RpdmVDb250cm9sbGVyJ1xuXHR9O1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdwcm9qZWN0ZGlyZWN0aXZlQ29udHJvbGxlcicsIGZ1bmN0aW9uKCRzY29wZSwgJHN0YXRlUGFyYW1zLCAkc3RhdGUsIFByb2plY3RGY3QsIEF1dGhTZXJ2aWNlKXtcblxuXG5cblx0XHRBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uKGxvZ2dlZEluVXNlcil7XG5cdFx0XHQkc2NvcGUubG9nZ2VkSW5Vc2VyID0gbG9nZ2VkSW5Vc2VyO1xuXHRcdFx0JHNjb3BlLmRpc3BsYXlBUHJvamVjdCA9IGZ1bmN0aW9uKHNvbWV0aGluZyl7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdUSElORycsIHNvbWV0aGluZyk7XG5cdFx0XHRcdGlmKCRzY29wZS5sb2dnZWRJblVzZXIuX2lkID09PSAkc3RhdGVQYXJhbXMudGhlSUQpe1xuXHRcdFx0XHRcdCRzdGF0ZS5nbygncHJvamVjdCcsIHtwcm9qZWN0SUQ6IHNvbWV0aGluZy5faWR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhcImRpc3BsYXlpbmcgYSBwcm9qZWN0XCIsIHByb2plY3RJRCk7XG5cdFx0XHR9XG5cblx0XHRcdCRzY29wZS5tYWtlRm9yayA9IGZ1bmN0aW9uKHByb2plY3Qpe1xuXHRcdFx0XHRwcm9qZWN0Lm93bmVyID0gbG9nZ2VkSW5Vc2VyLl9pZDtcblx0XHRcdFx0cHJvamVjdC5mb3JrSUQgPSBwcm9qZWN0Ll9pZDtcblx0XHRcdFx0ZGVsZXRlIHByb2plY3QuX2lkO1xuXHRcdFx0XHRjb25zb2xlLmxvZyhwcm9qZWN0KTtcblx0XHRcdFx0UHJvamVjdEZjdC5jcmVhdGVBRm9yayhwcm9qZWN0KS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKXtcblx0XHRcdFx0XHRjb25zb2xlLmxvZygnRm9yayByZXNwb25zZSBpcycsIHJlc3BvbnNlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFxuXHRcdC8vICRzdGF0ZS5nbygncHJvamVjdCcpXG59KTsiLCIndXNlIHN0cmljdCc7XG5hcHAuZGlyZWN0aXZlKCduYXZiYXInLCBmdW5jdGlvbigkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgQVVUSF9FVkVOVFMsICRzdGF0ZSkge1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgc2NvcGU6IHt9LFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuXG4gICAgICAgICAgICB2YXIgc2V0TmF2YmFyID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICAgICAgICAgICAgICBzY29wZS51c2VySWQgPSB1c2VyLl9pZDtcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUuaXRlbXMgPSBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsOiAnSG9tZScsIHN0YXRlOiAncHJvamVjdCcgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdNZW1iZXJzIE9ubHknLCBzdGF0ZTogJ3VzZXJQcm9maWxlKHt0aGVJRDogdXNlcklkfSknLCBhdXRoOiB0cnVlIH1cbiAgICAgICAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNldE5hdmJhcigpO1xuXG4gICAgICAgICAgICBzY29wZS5pdGVtcyA9IFtcbiAgICAgICAgICAgICAgICB7IGxhYmVsOiAnSG9tZScsIHN0YXRlOiAncHJvamVjdCcgfSxcbiAgICAgICAgICAgICAgICAvLyB7IGxhYmVsOiAnU2lnbiBVcCcsIHN0YXRlOiAnc2lnbnVwJyB9LFxuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdNZW1iZXJzIE9ubHknLCBzdGF0ZTogJ3VzZXJQcm9maWxlJywgYXV0aDogdHJ1ZSB9XG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcblxuICAgICAgICAgICAgc2NvcGUuaXNMb2dnZWRJbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzY29wZS5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgQXV0aFNlcnZpY2UubG9nb3V0KCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgc2V0VXNlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLnVzZXIgPSB1c2VyO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIHJlbW92ZVVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2NvcGUudXNlciA9IG51bGw7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzZXRVc2VyKCk7XG5cbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ2luU3VjY2Vzcywgc2V0VXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MsIHNldE5hdmJhcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzLCByZW1vdmVVc2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MsIHNldE5hdmJhcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgcmVtb3ZlVXNlcik7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxufSk7IiwiJ3VzZSBzdHJpY3QnO1xuYXBwLmRpcmVjdGl2ZSgncmFuZG9HcmVldGluZycsIGZ1bmN0aW9uIChSYW5kb21HcmVldGluZ3MpIHtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvcmFuZG8tZ3JlZXRpbmcvcmFuZG8tZ3JlZXRpbmcuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuICAgICAgICAgICAgc2NvcGUuZ3JlZXRpbmcgPSBSYW5kb21HcmVldGluZ3MuZ2V0UmFuZG9tR3JlZXRpbmcoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbn0pOyIsImFwcC5kaXJlY3RpdmUoJ3hpbVRyYWNrJywgZnVuY3Rpb24gKCRyb290U2NvcGUsICRzdGF0ZVBhcmFtcywgJGNvbXBpbGUsIFJlY29yZGVyRmN0LCBQcm9qZWN0RmN0LCBUb25lVHJhY2tGY3QsIFRvbmVUaW1lbGluZUZjdCwgQW5hbHlzZXJGY3QsICRxKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdFJyxcblx0XHR0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL3RyYWNrL3RyYWNrLmh0bWwnLFxuXHRcdGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuXHRcdFx0c2NvcGUuZWZmZWN0V2V0bmVzc2VzID0gWzAsMCwwLDBdO1xuXHRcdFx0c2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciBjYW52YXNSb3cgPSBlbGVtZW50WzBdLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2NhbnZhcy1ib3gnKTtcblxuXHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGNhbnZhc1Jvdy5sZW5ndGg7IGkrKykge1xuXG5cdFx0XHRcdFx0dmFyIGNhbnZhc0NsYXNzZXMgPSBjYW52YXNSb3dbaV0ucGFyZW50Tm9kZS5jbGFzc0xpc3Q7XG5cdFxuXHRcdFx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgY2FudmFzQ2xhc3Nlcy5sZW5ndGg7IGorKykge1xuXHRcdFx0XHRcdFx0aWYgKGNhbnZhc0NsYXNzZXNbal0gPT09ICd0YWtlbicpIHtcblx0XHRcdFx0XHRcdFx0YW5ndWxhci5lbGVtZW50KGNhbnZhc1Jvd1tpXSkuYXBwZW5kKCRjb21waWxlKFwiPGNhbnZhcyB3aWR0aD0nMTk4JyBoZWlnaHQ9Jzk4JyBpZD0nd2F2ZWRpc3BsYXknIGNsYXNzPSdpdGVtJyBzdHlsZT0ncG9zaXRpb246IGFic29sdXRlOycgZHJhZ2dhYmxlPjwvY2FudmFzPlwiKShzY29wZSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSwgMClcblxuXHRcdFx0c2NvcGUuZHJvcEluVGltZWxpbmUgPSBmdW5jdGlvbiAoaW5kZXgpIHtcblxuXHRcdFx0XHRzY29wZS50cmFjay5wbGF5ZXIubG9vcCA9IGZhbHNlO1xuXHRcdFx0XHRzY29wZS50cmFjay5wbGF5ZXIuc3RvcCgpO1xuXHRcdFx0XHRzY29wZS50cmFjay5vblRpbWVsaW5lID0gdHJ1ZTtcblx0XHRcdFx0dmFyIHBvc2l0aW9uID0gMDtcblx0XHRcdFx0dmFyIGNhbnZhc1JvdyA9IGVsZW1lbnRbMF0uZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnY2FudmFzLWJveCcpO1xuXG5cdFx0XHRcdGlmIChzY29wZS50cmFjay5sb2NhdGlvbi5sZW5ndGgpIHtcblx0XHRcdFx0XHQvLyBkcm9wIHRoZSBsb29wIG9uIHRoZSBmaXJzdCBhdmFpbGFibGUgaW5kZXhcdFx0XHRcdFxuXHRcdFx0XHRcdHdoaWxlIChzY29wZS50cmFjay5sb2NhdGlvbi5pbmRleE9mKHBvc2l0aW9uKSA+IC0xKSB7XG5cdFx0XHRcdFx0XHRwb3NpdGlvbisrO1xuXHRcdFx0XHRcdH1cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBhZGRpbmcgcmF3IGltYWdlIHRvIGRiXG5cdFx0XHRcdGlmICghc2NvcGUudHJhY2suaW1nKSB7XG5cdFx0XHRcdFx0c2NvcGUudHJhY2suaW1nID0gd2luZG93LmxhdGVzdFJlY29yZGluZ0ltYWdlLnJlcGxhY2UoL15kYXRhOmltYWdlXFwvcG5nO2Jhc2U2NCwvLCBcIlwiKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zb2xlLmxvZygncHVzaGluZycsIHBvc2l0aW9uKTtcblx0XHRcdFx0c2NvcGUudHJhY2subG9jYXRpb24ucHVzaChwb3NpdGlvbik7XG5cdFx0XHRcdHNjb3BlLnRyYWNrLmxvY2F0aW9uLnNvcnQoKTtcblx0XHRcdFx0dmFyIHRpbWVsaW5lSWQgPSBUb25lVHJhY2tGY3QuY3JlYXRlVGltZWxpbmVJbnN0YW5jZU9mTG9vcChzY29wZS50cmFjay5wbGF5ZXIsIHBvc2l0aW9uKTtcblx0XHRcdFx0YW5ndWxhci5lbGVtZW50KGNhbnZhc1Jvd1twb3NpdGlvbl0pLmFwcGVuZCgkY29tcGlsZShcIjxjYW52YXMgd2lkdGg9JzE5OCcgaGVpZ2h0PSc5OCcgcG9zaXRpb249J1wiICsgcG9zaXRpb24gKyBcIicgdGltZWxpbmVJZD0nXCIrdGltZWxpbmVJZCtcIicgaWQ9J21kaXNwbGF5XCIgKyAgaW5kZXggKyBcIi1cIiArIHBvc2l0aW9uICsgXCInIGNsYXNzPSdpdGVtIHRyYWNrTG9vcFwiK2luZGV4K1wiJyBzdHlsZT0ncG9zaXRpb246IGFic29sdXRlOycgZHJhZ2dhYmxlPjwvY2FudmFzPlwiKShzY29wZSkpO1xuXHRcdFx0XHR2YXIgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIFwibWRpc3BsYXlcIiArICBpbmRleCArIFwiLVwiICsgcG9zaXRpb24gKTtcbiAgICAgICAgICAgICAgICBkcmF3QnVmZmVyKCAxOTgsIDk4LCBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSwgc2NvcGUudHJhY2suYnVmZmVyICk7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCd0cmFjaycsIHNjb3BlLnRyYWNrKTtcblx0XHRcdH1cblxuXHRcdFx0c2NvcGUubW92ZUluVGltZWxpbmUgPSBmdW5jdGlvbiAob2xkVGltZWxpbmVJZCwgbmV3TWVhc3VyZSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3ICRxKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZygnRUxFTUVOVCcsIG9sZFRpbWVsaW5lSWQsIG5ld01lYXN1cmUpO1xuXHRcdFx0XHRcdFRvbmVUcmFja0ZjdC5yZXBsYWNlVGltZWxpbmVMb29wKHNjb3BlLnRyYWNrLnBsYXllciwgb2xkVGltZWxpbmVJZCwgbmV3TWVhc3VyZSkudGhlbihyZXNvbHZlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9O1xuXG5cblx0XHRcdHNjb3BlLmFwcGVhck9yRGlzYXBwZWFyID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcblx0XHRcdFx0dmFyIHRyYWNrSW5kZXggPSBzY29wZS4kcGFyZW50LnRyYWNrcy5pbmRleE9mKHNjb3BlLnRyYWNrKTtcblx0XHRcdFx0dmFyIGxvb3BJbmRleCA9IHNjb3BlLnRyYWNrLmxvY2F0aW9uLmluZGV4T2YocG9zaXRpb24pO1xuXHRcdFx0XHRjb25zb2xlLmxvZygnSU5ELCBQT1MnLCB0cmFja0luZGV4LCBwb3NpdGlvbik7XG5cdFx0XHRcdGNvbnNvbGUubG9nKHNjb3BlLnRyYWNrLmxvY2F0aW9uLmluZGV4T2YocG9zaXRpb24pKTtcblx0XHRcdFx0aWYoc2NvcGUudHJhY2sub25UaW1lbGluZSkge1xuXHRcdFx0XHRcdGlmKGxvb3BJbmRleCA9PT0gLTEpIHtcblx0XHRcdFx0XHRcdHZhciBjYW52YXNSb3cgPSBlbGVtZW50WzBdLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2NhbnZhcy1ib3gnKTtcblx0XHRcdFx0XHRcdHNjb3BlLnRyYWNrLmxvY2F0aW9uLnB1c2gocG9zaXRpb24pO1xuXHRcdFx0XHRcdFx0c2NvcGUudHJhY2subG9jYXRpb24uc29ydCgpO1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coc2NvcGUudHJhY2subG9jYXRpb24pO1xuXHRcdFx0XHRcdFx0dmFyIHRpbWVsaW5lSWQgPSBUb25lVHJhY2tGY3QuY3JlYXRlVGltZWxpbmVJbnN0YW5jZU9mTG9vcChzY29wZS50cmFjay5wbGF5ZXIsIHBvc2l0aW9uKTtcblx0XHRcdFx0XHRcdGFuZ3VsYXIuZWxlbWVudChjYW52YXNSb3dbcG9zaXRpb25dKS5hcHBlbmQoJGNvbXBpbGUoXCI8Y2FudmFzIHdpZHRoPScxOTgnIGhlaWdodD0nOTgnIHBvc2l0aW9uPSdcIiArIHBvc2l0aW9uICsgXCInIHRpbWVsaW5lSWQ9J1wiK3RpbWVsaW5lSWQrXCInIGlkPSdtZGlzcGxheVwiICsgIHRyYWNrSW5kZXggKyBcIi1cIiArIHBvc2l0aW9uICsgXCInIGNsYXNzPSdpdGVtIHRyYWNrTG9vcFwiK3RyYWNrSW5kZXgrXCInIHN0eWxlPSdwb3NpdGlvbjogYWJzb2x1dGU7JyBkcmFnZ2FibGU+PC9jYW52YXM+XCIpKHNjb3BlKSk7XG5cdFx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZygndHJhY2snLCBzY29wZS50cmFjayk7XG5cdFx0XHRcdFx0XHR2YXIgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIFwibWRpc3BsYXlcIiArICB0cmFja0luZGV4ICsgXCItXCIgKyBwb3NpdGlvbiApO1xuXHRcdCAgICAgICAgICAgICAgICBkcmF3QnVmZmVyKCAxOTgsIDk4LCBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSwgc2NvcGUudHJhY2suYnVmZmVyICk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHZhciBjYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggXCJtZGlzcGxheVwiICsgIHRyYWNrSW5kZXggKyBcIi1cIiArIHBvc2l0aW9uICk7XG5cdFx0XHRcdFx0XHQvL3JlbW92ZSBmcm9tIGxvY2F0aW9ucyBhcnJheVxuXHRcdFx0XHRcdFx0c2NvcGUudHJhY2subG9jYXRpb24uc3BsaWNlKGxvb3BJbmRleCwgMSk7XG5cdFx0XHRcdFx0XHQvL3JlbW92ZSB0aW1lbGluZUlkXG5cdFx0XHRcdFx0XHRUb25lVHJhY2tGY3QuZGVsZXRlVGltZWxpbmVMb29wKCBjYW52YXMuYXR0cmlidXRlcy50aW1lbGluZWlkLnZhbHVlICk7XG5cdFx0XHRcdFx0XHQvL3JlbW92ZSBjYW52YXMgaXRlbVxuXHRcdFx0XHRcdFx0ZnVuY3Rpb24gcmVtb3ZlRWxlbWVudChlbGVtZW50KSB7XG5cdFx0XHRcdFx0XHQgICAgZWxlbWVudCAmJiBlbGVtZW50LnBhcmVudE5vZGUgJiYgZWxlbWVudC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGVsZW1lbnQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmVtb3ZlRWxlbWVudCggY2FudmFzICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdOTyBEUk9QJyk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdHNjb3BlLnJlUmVjb3JkID0gZnVuY3Rpb24gKGluZGV4KSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdSRVJFQ09SRCcpO1xuXHRcdFx0XHRjb25zb2xlLmxvZyhzY29wZS50cmFjayk7XG5cdFx0XHRcdC8vY2hhbmdlIGFsbCBwYXJhbXMgYmFjayBhcyBpZiBlbXB0eSB0cmFja1xuXHRcdFx0XHRzY29wZS50cmFjay5lbXB0eSA9IHRydWU7XG5cdFx0XHRcdHNjb3BlLnRyYWNrLm9uVGltZWxpbmUgPSBmYWxzZTtcblx0XHRcdFx0c2NvcGUudHJhY2sucGxheWVyID0gbnVsbDtcblx0XHRcdFx0c2NvcGUudHJhY2suc2lsZW5jZSA9IGZhbHNlO1xuXHRcdFx0XHRzY29wZS50cmFjay5yYXdBdWRpbyA9IG51bGw7XG5cdFx0XHRcdHNjb3BlLnRyYWNrLmltZyA9IG51bGw7XG5cdFx0XHRcdHNjb3BlLnRyYWNrLnByZXZpZXdpbmcgPSBmYWxzZTtcblx0XHRcdFx0Ly9kaXNwb3NlIG9mIGVmZmVjdHNSYWNrXG5cdFx0XHRcdHNjb3BlLnRyYWNrLmVmZmVjdHNSYWNrLmZvckVhY2goZnVuY3Rpb24gKGVmZmVjdCkge1xuXHRcdFx0XHRcdGVmZmVjdC5kaXNwb3NlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRzY29wZS50cmFjay5lZmZlY3RzUmFjayA9IFRvbmVUcmFja0ZjdC5lZmZlY3RzSW5pdGlhbGl6ZSgpO1xuXHRcdFx0XHRzY29wZS50cmFjay5sb2NhdGlvbiA9IFtdO1xuXHRcdFx0XHQvL3JlbW92ZSBhbGwgbG9vcHMgZnJvbSBVSVxuXHRcdFx0XHR2YXIgbG9vcHNVSSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3RyYWNrTG9vcCcraW5kZXgudG9TdHJpbmcoKSk7XG5cdFx0XHRcdHdoaWxlKGxvb3BzVUkubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRcdFx0Zm9yKHZhciBpID0gMDsgaSA8IGxvb3BzVUkubGVuZ3RoO2krKykge1xuXHRcdFx0XHRcdFx0bG9vcHNVSVtpXS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGxvb3BzVUlbaV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR2YXIgbG9vcHNVSSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3RyYWNrTG9vcCcraW5kZXgudG9TdHJpbmcoKSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdHNjb3BlLnNvbG8gPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciBvdGhlclRyYWNrcyA9IHNjb3BlLiRwYXJlbnQudHJhY2tzLm1hcChmdW5jdGlvbiAodHJhY2spIHtcblx0XHRcdFx0XHRpZih0cmFjayAhPT0gc2NvcGUudHJhY2spIHtcblx0XHRcdFx0XHRcdHRyYWNrLnNpbGVuY2UgPSB0cnVlO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRyYWNrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkuZmlsdGVyKGZ1bmN0aW9uICh0cmFjaykge1xuXHRcdFx0XHRcdGlmKHRyYWNrICYmIHRyYWNrLnBsYXllcikgcmV0dXJuIHRydWU7XG5cdFx0XHRcdH0pXG5cblx0XHRcdFx0Y29uc29sZS5sb2cob3RoZXJUcmFja3MpO1xuXHRcdFx0XHRUb25lVGltZWxpbmVGY3QubXV0ZUFsbChvdGhlclRyYWNrcyk7XG5cdFx0XHRcdHNjb3BlLnRyYWNrLnNpbGVuY2UgPSBmYWxzZTtcblx0XHRcdFx0c2NvcGUudHJhY2sucGxheWVyLnZvbHVtZS52YWx1ZSA9IDA7XG5cdFx0XHR9XG5cblx0XHRcdHNjb3BlLnNpbGVuY2UgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmKCFzY29wZS50cmFjay5zaWxlbmNlKSB7XG5cdFx0XHRcdFx0c2NvcGUudHJhY2sucGxheWVyLnZvbHVtZS52YWx1ZSA9IC0xMDA7XG5cdFx0XHRcdFx0c2NvcGUudHJhY2suc2lsZW5jZSA9IHRydWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2NvcGUudHJhY2sucGxheWVyLnZvbHVtZS52YWx1ZSA9IDA7XG5cdFx0XHRcdFx0c2NvcGUudHJhY2suc2lsZW5jZSA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHNjb3BlLnJlY29yZCA9IGZ1bmN0aW9uIChpbmRleCkge1xuXHRcdFx0XHRUb25lVGltZWxpbmVGY3QubXV0ZUFsbChzY29wZS4kcGFyZW50LnRyYWNrcyk7XG5cdFx0XHRcdHZhciByZWNvcmRlciA9IHNjb3BlLnJlY29yZGVyO1xuXG5cdFx0XHRcdHZhciBjb250aW51ZVVwZGF0ZSA9IHRydWU7XG5cblx0XHRcdFx0Ly9hbmFseXNlciBzdHVmZlxuXHRcdCAgICAgICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYW5hbHlzZXJcIitpbmRleCk7XG5cdFx0ICAgICAgICB2YXIgYW5hbHlzZXJDb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG5cdFx0ICAgICAgICB2YXIgYW5hbHlzZXJOb2RlID0gc2NvcGUuYW5hbHlzZXJOb2RlO1xuXHRcdFx0XHR2YXIgYW5hbHlzZXJJZCA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIHVwZGF0ZSApO1xuXG5cdFx0XHRcdHNjb3BlLnRyYWNrLnJlY29yZGluZyA9IHRydWU7XG5cdFx0XHRcdHNjb3BlLnRyYWNrLmVtcHR5ID0gdHJ1ZTtcblx0XHRcdFx0UmVjb3JkZXJGY3QucmVjb3JkU3RhcnQocmVjb3JkZXIpO1xuXHRcdFx0XHRzY29wZS50cmFjay5wcmV2aWV3aW5nID0gZmFsc2U7XG5cblxuXHRcdFx0XHRmdW5jdGlvbiB1cGRhdGUoKSB7XG5cdFx0XHRcdFx0dmFyIFNQQUNJTkcgPSAzO1xuXHRcdFx0XHRcdHZhciBCQVJfV0lEVEggPSAxO1xuXHRcdFx0XHRcdHZhciBudW1CYXJzID0gTWF0aC5yb3VuZCgzMDAgLyBTUEFDSU5HKTtcblx0XHRcdFx0XHR2YXIgZnJlcUJ5dGVEYXRhID0gbmV3IFVpbnQ4QXJyYXkoYW5hbHlzZXJOb2RlLmZyZXF1ZW5jeUJpbkNvdW50KTtcblxuXHRcdFx0XHRcdGFuYWx5c2VyTm9kZS5nZXRCeXRlRnJlcXVlbmN5RGF0YShmcmVxQnl0ZURhdGEpOyBcblxuXHRcdFx0XHRcdGFuYWx5c2VyQ29udGV4dC5jbGVhclJlY3QoMCwgMCwgMzAwLCAxMDApO1xuXHRcdFx0XHRcdGFuYWx5c2VyQ29udGV4dC5maWxsU3R5bGUgPSAnI0Y2RDU2NSc7XG5cdFx0XHRcdFx0YW5hbHlzZXJDb250ZXh0LmxpbmVDYXAgPSAncm91bmQnO1xuXHRcdFx0XHRcdHZhciBtdWx0aXBsaWVyID0gYW5hbHlzZXJOb2RlLmZyZXF1ZW5jeUJpbkNvdW50IC8gbnVtQmFycztcblxuXHRcdFx0XHRcdC8vIERyYXcgcmVjdGFuZ2xlIGZvciBlYWNoIGZyZXF1ZW5jeSBiaW4uXG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBudW1CYXJzOyArK2kpIHtcblx0XHRcdFx0XHRcdHZhciBtYWduaXR1ZGUgPSAwO1xuXHRcdFx0XHRcdFx0dmFyIG9mZnNldCA9IE1hdGguZmxvb3IoIGkgKiBtdWx0aXBsaWVyICk7XG5cdFx0XHRcdFx0XHQvLyBnb3R0YSBzdW0vYXZlcmFnZSB0aGUgYmxvY2ssIG9yIHdlIG1pc3MgbmFycm93LWJhbmR3aWR0aCBzcGlrZXNcblx0XHRcdFx0XHRcdGZvciAodmFyIGogPSAwOyBqPCBtdWx0aXBsaWVyOyBqKyspXG5cdFx0XHRcdFx0XHQgICAgbWFnbml0dWRlICs9IGZyZXFCeXRlRGF0YVtvZmZzZXQgKyBqXTtcblx0XHRcdFx0XHRcdG1hZ25pdHVkZSA9IG1hZ25pdHVkZSAvIG11bHRpcGxpZXI7XG5cdFx0XHRcdFx0XHR2YXIgbWFnbml0dWRlMiA9IGZyZXFCeXRlRGF0YVtpICogbXVsdGlwbGllcl07XG5cdFx0XHRcdFx0XHRhbmFseXNlckNvbnRleHQuZmlsbFN0eWxlID0gXCJoc2woIFwiICsgTWF0aC5yb3VuZCgoaSozNjApL251bUJhcnMpICsgXCIsIDEwMCUsIDUwJSlcIjtcblx0XHRcdFx0XHRcdGFuYWx5c2VyQ29udGV4dC5maWxsUmVjdChpICogU1BBQ0lORywgMTAwLCBCQVJfV0lEVEgsIC1tYWduaXR1ZGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZihjb250aW51ZVVwZGF0ZSkge1xuXHRcdFx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggdXBkYXRlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0UmVjb3JkZXJGY3QucmVjb3JkU3RvcChpbmRleCwgcmVjb3JkZXIpLnRoZW4oZnVuY3Rpb24gKHBsYXllcikge1xuXHRcdFx0XHRcdFx0c2NvcGUudHJhY2sucmVjb3JkaW5nID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRzY29wZS50cmFjay5lbXB0eSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0Y29udGludWVVcGRhdGUgPSBmYWxzZTtcblx0XHRcdFx0XHRcdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSggYW5hbHlzZXJJZCApO1xuXHRcdFx0XHRcdFx0c2NvcGUudHJhY2sucGxheWVyID0gcGxheWVyO1xuXHRcdFx0XHRcdFx0c2NvcGUudHJhY2sucGxheWVyLmxvb3AgPSB0cnVlO1xuXHRcdFx0XHRcdFx0c2NvcGUudHJhY2suYnVmZmVyID0gd2luZG93LmxhdGVzdEJ1ZmZlcjtcblx0XHRcdFx0XHRcdHNjb3BlLnRyYWNrLnJhd0F1ZGlvID0gd2luZG93LmxhdGVzdFJlY29yZGluZztcblx0XHRcdFx0XHRcdHBsYXllci5jb25uZWN0KHNjb3BlLnRyYWNrLmVmZmVjdHNSYWNrWzBdKTtcblx0XHRcdFx0XHRcdHNjb3BlLiRwYXJlbnQubWV0cm9ub21lLnN0b3AoKTtcblx0XHRcdFx0XHRcdHdpbmRvdy5jbGVhckludGVydmFsKGNsaWNrKTtcblxuXHRcdFx0XHRcdFx0c2NvcGUuJHBhcmVudC5zdG9wKCk7XG5cdFx0XHRcdFx0XHRUb25lVGltZWxpbmVGY3QudW5NdXRlQWxsKHNjb3BlLiRwYXJlbnQudHJhY2tzKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSwgNDAwMCk7XG5cblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0UmVjb3JkZXJGY3QucmVjb3JkU3RhcnQocmVjb3JkZXIsIGluZGV4KTtcblx0XHRcdFx0fSwgMjAwMCk7XG5cdFx0XHRcdHNjb3BlLiRwYXJlbnQubWV0cm9ub21lLnN0YXJ0KCk7XG5cblx0XHRcdFx0dmFyIGNsaWNrID0gd2luZG93LnNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRzY29wZS4kcGFyZW50Lm1ldHJvbm9tZS5zdG9wKCk7XG5cdFx0XHRcdFx0c2NvcGUuJHBhcmVudC5tZXRyb25vbWUuc3RhcnQoKTtcblx0XHRcdFx0fSwgNTAwKTtcblxuXHRcdFx0fVxuXHRcdFx0c2NvcGUucHJldmlldyA9IGZ1bmN0aW9uKGN1cnJlbnRseVByZXZpZXdpbmcpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coY3VycmVudGx5UHJldmlld2luZyk7XG5cdFx0XHRcdGlmKGN1cnJlbnRseVByZXZpZXdpbmcpIHtcblx0XHRcdFx0XHRzY29wZS50cmFjay5wbGF5ZXIuc3RvcCgpO1xuXHRcdFx0XHRcdHNjb3BlLnRyYWNrLnByZXZpZXdpbmcgPSBmYWxzZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzY29wZS50cmFjay5wbGF5ZXIuc3RhcnQoKTtcblx0XHRcdFx0XHRzY29wZS50cmFjay5wcmV2aWV3aW5nID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0c2NvcGUuY2hhbmdlV2V0bmVzcyA9IGZ1bmN0aW9uKGVmZmVjdCwgYW1vdW50KSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGVmZmVjdCk7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGFtb3VudCk7XG5cblx0XHRcdFx0ZWZmZWN0LndldC52YWx1ZSA9IGFtb3VudCAvIDEwMDA7XG5cdFx0XHR9O1xuXG5cdFx0fVxuXHRcdFxuXG5cdH1cbn0pOyJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==