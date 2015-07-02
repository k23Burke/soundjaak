'use strict';
app.config(function ($stateProvider) {
    $stateProvider.state('project', {
        url: '/project/:projectID',
        templateUrl: 'js/project/project.html'
    });
});


app.controller('ProjectController', function ($scope, $stateParams, $localStorage, RecorderFct, ProjectFct, TonePlayerFct, ToneTimelineFct, AuthService) {
  console.log("state", $stateParams);
  var wavArray = [];
  
  $scope.numMeasures = [];
  for (var i = 0; i < 60; i++) {
    $scope.numMeasures.push(i);
  }

  $scope.measureLength = 1;
  $scope.tracks = [];
  $scope.loading = true;
  // $scope.projectid = $stateParams;

  ProjectFct.getProjectInfo($stateParams).then(function (project) {
      var loaded = 0;
      console.log('PROJECT', project);

      if (project.tracks.length) {
        project.tracks.forEach(function (track) {
            var doneLoading = function () {
                loaded++;
                if(loaded === project.tracks.length) {
                    $scope.loading = false;
                    // Tone.Transport.start();
                }
            };
            track.player = TonePlayerFct.createPlayer(track.url, doneLoading);
            ToneTimelineFct.addLoopToTimeline(track.player, track.locations);
            $scope.tracks.push(track);
        });
      } else {
        for (var i = 0; i < 6; i++) {
          var obj = {};
          obj.name = 'Track ' + (i+1);
          obj.location = [];
          $scope.tracks.push(obj);
        }
      }

      ToneTimelineFct.getTransport(project.endMeasure);
      ToneTimelineFct.changeBpm(project.bpm);

  });

  $scope.record = function (e, index) {

  	e = e.toElement;

        // start recording
        console.log('start recording');
        
        if (!audioRecorder)
            return;

        e.classList.add("recording");
        audioRecorder.clear();
        audioRecorder.record();

        window.setTimeout(function() {
		audioRecorder.stop();
		e.classList.remove("recording");
		audioRecorder.getBuffers( gotBuffers );

		window.setTimeout(function () {
			$scope.tracks[index].rawAudio = window.latestRecording;
			$scope.tracks[index].rawImage = window.latestRecordingImage;
			console.log('trackss', $scope.tracks);
			// wavArray.push(window.latestRecording);
			// console.log('wavArray', wavArray);
		}, 500);
          
        }, 2000);

  }

  $scope.addTrack = function () {

  };

  $scope.sendToAWS = function () {

    RecorderFct.sendToAWS($scope.tracks).then(function (response) {
        // wave logic
        console.log('response from sendToAWS', response);

    });
  };
  $scope.isLoggedIn = function () {
        return AuthService.isAuthenticated();
    };
});