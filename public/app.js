const firebaseConfig = {
  apiKey: "AIzaSyBXdXU1IPILDzy64y-ye_shjsJit8BP0Ys",
  authDomain: "cyber-phoenix-46ebd.firebaseapp.com",
  projectId: "cyber-phoenix-46ebd",
  storageBucket: "cyber-phoenix-46ebd.firebasestorage.app",
  messagingSenderId: "839421448888",
  appId: "1:839421448888:web:c0835cf6bdbe23ec7d9a4d"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// Fix for 'client is offline' issues in some environments
db.settings({ experimentalForceLongPolling: true });
const auth = firebase.auth();

var app = angular.module('cyberPhoenixApp', ['ngRoute', 'ngAnimate']);

app.config(['$routeProvider', function($routeProvider) {
    $routeProvider
        .when('/', {
            templateUrl: 'views/landing.html',
            controller: 'AuthCtrl'
        })
        .when('/dashboard', {
            templateUrl: 'views/learner-dashboard.html',
            controller: 'DashboardCtrl',
            resolve: { auth: checkAuth('learner') }
        })
        .when('/sim-phishing', {
            templateUrl: 'views/sim-phishing.html',
            controller: 'SimPhishingCtrl',
            resolve: { auth: checkAuth('learner') }
        })
        .when('/sim-password', {
            templateUrl: 'views/sim-password.html',
            controller: 'SimPasswordCtrl',
            resolve: { auth: checkAuth('learner') }
        })
        .when('/sim-quiz', {
            templateUrl: 'views/sim-quiz.html',
            controller: 'SimQuizCtrl',
            resolve: { auth: checkAuth('learner') }
        })
        .when('/rewards', {
            templateUrl: 'views/rewards.html',
            controller: 'RewardsCtrl',
            resolve: { auth: checkAuth('learner') }
        })
        .when('/admin', {
            templateUrl: 'views/admin-dashboard.html',
            controller: 'AdminDashboardCtrl',
            resolve: { auth: checkAuth('admin') }
        })
        .when('/admin-users', {
            templateUrl: 'views/admin-users.html',
            controller: 'AdminUsersCtrl',
            resolve: { auth: checkAuth('admin') }
        })
        .when('/admin-scenarios', {
            templateUrl: 'views/admin-scenarios.html',
            controller: 'AdminScenariosCtrl',
            resolve: { auth: checkAuth('admin') }
        })
        .otherwise({
            redirectTo: '/'
        });
}]);

function checkAuth(roleRequired) {
    return ['$q', '$location', 'AuthService', function($q, $location, AuthService) {
        var deferred = $q.defer();
        AuthService.waitForAuth().then(function() {
            var userRole = AuthService.getRole();
            if (AuthService.isLoggedIn() && (!roleRequired || userRole === roleRequired || (userRole==='admin' && roleRequired==='learner'))) {
                deferred.resolve();
            } else {
                $location.path('/');
                deferred.reject();
            }
        });
        return deferred.promise;
    }];
}

app.service('AuthService', ['$q', '$rootScope', function($q, $rootScope) {
    var currentUser = null;
    var userRole = null;
    var userData = null;
    var authInitialized = false;
    var authPromise = $q.defer();

    auth.onAuthStateChanged(function(user) {
        currentUser = user;
        if (user) {
            db.collection('users').doc(user.uid).get().then(function(doc) {
                if (doc.exists) {
                    userData = doc.data();
                    userRole = userData.role || 'learner';
                } else {
                    userRole = 'learner';
                }
                if (!authInitialized) {
                    authInitialized = true;
                    authPromise.resolve();
                }
                $rootScope.$applyAsync();
            });
        } else {
            userRole = null;
            userData = null;
            if (!authInitialized) {
                authInitialized = true;
                authPromise.resolve();
            }
            $rootScope.$applyAsync();
        }
    });

    this.waitForAuth = function() {
        return authPromise.promise;
    };

    this.login = function(email, pass) {
        var deferred = $q.defer();
        auth.signInWithEmailAndPassword(email, pass).then(function(userCredential) {
            db.collection('users').doc(userCredential.user.uid).get().then(function(doc) {
                if (doc.exists) {
                    userData = doc.data();
                    userRole = userData.role || 'learner';
                } else {
                    userRole = 'learner';
                    userData = { email: email, role: 'learner', username: email.split('@')[0], score: 0, level: 1, progress: 0, completedModules: {} };
                }
                deferred.resolve({ role: userRole });
            }).catch(function(err) {
                deferred.reject(err);
            });
        }).catch(function(error) {
            deferred.reject(error);
        });
        return deferred.promise;
    };

    this.signup = function(email, pass, username) {
        var deferred = $q.defer();
        auth.createUserWithEmailAndPassword(email, pass).then(function(userCredential) {
            var newUser = {
                email: email,
                username: username,
                name: username,
                role: 'learner',
                score: 0,
                level: 1,
                progress: 0,
                completedModules: {}
            };
            db.collection('users').doc(userCredential.user.uid).set(newUser).then(function() {
                userData = newUser;
                userRole = 'learner';
                deferred.resolve({ role: 'learner' });
            });
        }).catch(function(error) {
            deferred.reject(error);
        });
        return deferred.promise;
    };

    this.logout = function() {
        return auth.signOut();
    };

    this.isLoggedIn = function() { return !!currentUser; };
    this.getRole = function() { return userRole; };
    this.getUsername = function() { return userData ? userData.username : ''; };
    this.getUid = function() { return currentUser ? currentUser.uid : null; };
    this.getUserData = function() { return userData; };
    
    this.addScore = function(points, moduleName) {
        if (!currentUser || !userData) return;
        
        // Ensure all required fields exist
        if (!userData.completedModules) userData.completedModules = {};
        if (userData.completedModules[moduleName]) {
            // Already completed, just update score if needed
            // return $q.when(); 
        }
        
        userData.completedModules[moduleName] = true;
        userData.score = (userData.score || 0) + points;
        userData.level = Math.floor(userData.score / 500) + 1;

        var completedCount = Object.keys(userData.completedModules).length;
        var totalModules = 3; 
        userData.progress = Math.round((completedCount / totalModules) * 100);

        var updates = {
            score: userData.score,
            level: userData.level,
            progress: userData.progress
        };
        updates[`completedModules.${moduleName}`] = true;

        return db.collection('users').doc(currentUser.uid).update(updates).then(function() {
            $rootScope.$applyAsync();
        });
    };
}]);

app.controller('NavCtrl', ['$scope', 'AuthService', '$location', function($scope, AuthService, $location) {
    $scope.$watch(function() { return AuthService.isLoggedIn(); }, function(val) {
        $scope.isLoggedIn = AuthService.isLoggedIn();
        $scope.role = AuthService.getRole();
        $scope.username = AuthService.getUsername();
    });

    $scope.logout = function() {
        AuthService.logout().then(function() {
            $location.path('/');
            $scope.$applyAsync();
        });
    };
}]);

app.controller('AuthCtrl', ['$scope', 'AuthService', '$location', function($scope, AuthService, $location) {
    $scope.isSignUp = false;
    $scope.email = '';
    $scope.username = '';
    $scope.password = '';
    $scope.error = '';

    $scope.toggleMode = function() {
        $scope.isSignUp = !$scope.isSignUp;
        $scope.error = '';
    };

    $scope.submitAuth = function() {
        if ($scope.isSignUp) {
            AuthService.signup($scope.email, $scope.password, $scope.username).then(function(res) {
                $location.path('/dashboard');
                $scope.$applyAsync();
            }).catch(function(err) {
                $scope.error = err.message;
                $scope.$applyAsync();
            });
        } else {
            AuthService.login($scope.email, $scope.password).then(function(res) {
                if (res.role === 'admin') {
                    $location.path('/admin');
                } else {
                    $location.path('/dashboard');
                }
                $scope.$applyAsync();
            }).catch(function(err) {
                $scope.error = err.message;
                $scope.$applyAsync();
            });
        }
    };
}]);

app.controller('DashboardCtrl', ['$scope', 'AuthService', function($scope, AuthService) {
    var updateView = function() {
        var uData = AuthService.getUserData() || {};
        $scope.progress = uData.progress || 0;
        $scope.level = uData.level || 1;
        $scope.score = uData.score || 0;
        var completed = uData.completedModules || {};

        $scope.modules = [
            { title: 'Phishing Detection', path: '/sim-phishing', status: completed['phishing'] ? 'completed' : 'pending' },
            { title: 'Password Security', path: '/sim-password', status: completed['password'] ? 'completed' : 'pending' },
            { title: 'Social Engineering Quiz', path: '/sim-quiz', status: completed['quiz'] ? 'completed' : 'pending' }
        ];
    };

    updateView();
    $scope.$watch(function() { return AuthService.getUserData(); }, updateView, true);
}]);

app.controller('SimPhishingCtrl', ['$scope', '$timeout', 'AuthService', '$location', function($scope, $timeout, AuthService, $location) {
    $scope.emails = [
        {
            from: 'IT Support <admin@cyber-phoenlx.com>',
            subject: 'URGENT: Password Expiry Notification',
            date: 'Today, 09:42 AM',
            body: ['Your network password is set to expire in 2 hours. Please click the secure link below to update your credentials:'],
            links: [
                { text: 'https://secure.cyber-phoenix.com/update-password', url: 'http://login-update-security-check.com/auth', isPhishing: true },
                { text: 'helpdesk', url: 'mailto:support@cyber-phoenix.com', isPhishing: false }
            ]
        },
        {
            from: 'HR Department <hr@cyber-phoenix-portal.com>',
            subject: 'Action Required: Updated Employee Handbook',
            date: 'Yesterday, 14:30 PM',
            body: ['We have updated our employee handbook with new policies regarding remote work. Please review and confirm acknowledgment.'],
            links: [
                { text: 'Review Employee Handbook', url: 'http://cyber-phoenix-hr-portal-login.net/docs', isPhishing: true }
            ]
        },
        {
            from: 'Microsoft 365 <no-reply@microsoft365-alert.com>',
            subject: 'Unusual sign-in activity',
            date: 'Today, 03:22 AM',
            body: ['We detected something unusual about a recent sign-in to your Microsoft account. If this wasn\'t you, please secure your account.'],
            links: [
                { text: 'Review recent activity', url: 'http://microsoft-secure-login-update.com/alert', isPhishing: true }
            ]
        },
        {
            from: 'Internal IT <support@cyber-phoenix.com>',
            subject: 'Scheduled Maintenance Notice',
            date: '2 Days Ago',
            body: ['All Staff, server maintenance this weekend. Expect intermittent downtime. For more details, visit our wiki:'],
            links: [
                { text: 'Maintenance Schedule', url: 'https://wiki.cyber-phoenix.com/maintenance', isPhishing: false }
            ]
        }
    ];

    $scope.currentEmail = 0;
    $scope.showFeedback = false;
    $scope.isCorrect = false;
    $scope.feedbackMessage = '';
    $scope.isComplete = false;
    var feedbackTimeout = null;

    $scope.nextEmail = function() {
        if (feedbackTimeout) $timeout.cancel(feedbackTimeout);
        $scope.showFeedback = false;
        
        if ($scope.currentEmail < $scope.emails.length - 1) {
            $scope.currentEmail++;
        } else {
            $scope.isComplete = true;
            AuthService.addScore(50, 'phishing');
        }
    };

    $scope.checkLink = function(isPhishing) {
        if (isPhishing) {
            $scope.isCorrect = true;
            $scope.feedbackMessage = 'Correct! That was a phishing attempt.';
        } else {
            $scope.isCorrect = false;
            $scope.feedbackMessage = 'Be careful! That was a legitimate link, but you should always verify the source.';
        }
        $scope.showFeedback = true;
        feedbackTimeout = $timeout($scope.nextEmail, 4000);
    };

    $scope.goHome = function() {
        $location.path('/dashboard');
    };
}]);

app.controller('SimPasswordCtrl', ['$scope', 'AuthService', '$timeout', function($scope, AuthService, $timeout) {
    $scope.password = '';
    $scope.entropy = 0;
    $scope.strength = 'Weak';
    $scope.completed = false;
    
    $scope.checkStrength = function() {
        var score = 0;
        if (!$scope.password) { $scope.entropy = 0; $scope.strength = 'Weak'; return; }
        if ($scope.password.length > 8) score += 20;
        if ($scope.password.length > 12) score += 20;
        if (/[A-Z]/.test($scope.password)) score += 20;
        if (/[0-9]/.test($scope.password)) score += 20;
        if (/[^A-Za-z0-9]/.test($scope.password)) score += 20;
        
        $scope.entropy = score;
        if (score < 40) $scope.strength = 'Weak';
        else if (score < 80) $scope.strength = 'Medium';
        else {
            $scope.strength = 'Strong';
            if (!$scope.completed && score >= 100) {
                $scope.completed = true;
                AuthService.addScore(100, 'password');
                $timeout(function() { alert("Password Mastered! 100 points awarded."); }, 500);
            }
        }
    };
}]);

app.controller('SimQuizCtrl', ['$scope', '$timeout', 'AuthService', '$location', function($scope, $timeout, AuthService, $location) {
    $scope.questions = [
        { text: 'A colleague asks for your password. What should you do?', options: ['Give it to them', 'Refuse and report it', 'Create a guest account'], answer: 1 },
        { text: 'You find a USB drive in the parking lot. What do you do?', options: ['Plug it in', 'Throw it away', 'Turn it in to IT'], answer: 2 },
        { text: 'The "CEO" asks you to buy gift cards urgently via email. Action?', options: ['Buy them', 'Verify via phone/person', 'Email back for info'], answer: 1 }
    ];
    $scope.currentQ = 0;
    $scope.showFeedback = false;
    $scope.isComplete = false;
    $scope.score = 0;
    var quizTimeout = null;

    $scope.nextQuestion = function() {
        if (quizTimeout) $timeout.cancel(quizTimeout);
        $scope.showFeedback = false;
        
        if ($scope.currentQ < $scope.questions.length - 1) {
            $scope.currentQ++;
        } else {
            $scope.isComplete = true;
            AuthService.addScore($scope.score, 'quiz');
        }
    };
    
    $scope.selectOption = function(index) {
        $scope.isCorrect = (index === $scope.questions[$scope.currentQ].answer);
        $scope.feedbackMessage = $scope.isCorrect ? 'Correct!' : 'Incorrect.';
        if ($scope.isCorrect) $scope.score += 20;
        $scope.showFeedback = true;
        quizTimeout = $timeout($scope.nextQuestion, 3000);
    };

    $scope.goHome = function() {
        $location.path('/dashboard');
    };
}]);

app.controller('RewardsCtrl', ['$scope', function($scope) {
    $scope.leaderboard = [];
    $scope.loading = true;
    $scope.error = null;

    // Real-time listener for the leaderboard
    var unsubscribe = db.collection('users')
        .orderBy('score', 'desc')
        .limit(10)
        .onSnapshot(function(snapshot) {
            var lb = [];
            var rank = 1;
            snapshot.forEach(function(doc) {
                var data = doc.data();
                lb.push({ 
                    rank: rank++, 
                    name: data.username || data.name || data.email || 'Anonymous Agent', 
                    score: data.score || 0,
                    uid: doc.id
                });
            });
            
            $scope.$apply(function() {
                $scope.leaderboard = lb;
                $scope.loading = false;
                
                // Find current user in the leaderboard or show their own data
                var myData = AuthService.getUserData();
                if (myData) {
                    $scope.myRank = "N/A";
                    $scope.myScore = myData.score || 0;
                    // Note: In a real app, you'd query for rank if not in top 10
                    // For now, we check if they are in the loaded top 10
                    for (var i=0; i < lb.length; i++) {
                        if (lb[i].uid === AuthService.getUid()) {
                            $scope.myRank = lb[i].rank;
                            break;
                        }
                    }
                }
            });
        }, function(err) {
            console.error("Leaderboard Error:", err);
            $scope.$apply(function() {
                $scope.error = "Unable to retrieve roster. Check console for details.";
                $scope.loading = false;
            });
        });

    // Cleanup listener when scope is destroyed
    $scope.$on('$destroy', function() {
        if (unsubscribe) unsubscribe();
    });
}]);

app.controller('AdminDashboardCtrl', ['$scope', function($scope) {
    $scope.stats = { totalUsers: 0, avgScore: 0, activeSimulations: 3 };
    db.collection('users').get().then(function(snapshot) {
        var total = snapshot.size;
        var sum = 0;
        snapshot.forEach(function(doc) {
            sum += (doc.data().score || 0);
        });
        $scope.stats.totalUsers = total;
        $scope.stats.avgScore = total > 0 ? Math.round(sum / total) : 0;
        $scope.$applyAsync();
    });
}]);

app.controller('AdminUsersCtrl', ['$scope', function($scope) {
    $scope.users = [];
    $scope.loadUsers = function() {
        db.collection('users').get().then(function(snapshot) {
            var u = [];
            snapshot.forEach(function(doc) {
                var d = doc.data();
                u.push({ id: doc.id, username: d.email, name: d.username, level: d.level, score: d.score });
            });
            $scope.users = u;
            $scope.$applyAsync();
        });
    };
    $scope.removeUser = function(id) {
        db.collection('users').doc(id).delete().then(function() {
            $scope.loadUsers();
        });
    };
    $scope.loadUsers();
}]);

app.controller('AdminScenariosCtrl', ['$scope', function($scope) {
    $scope.scenarios = [];
    $scope.newScenario = { title: '', type: 'phishing', difficulty: 'Easy' };
    
    $scope.loadScenarios = function() {
        db.collection('scenarios').get().then(function(snapshot) {
            var s = [];
            snapshot.forEach(function(doc) { s.push(Object.assign({id: doc.id}, doc.data())); });
            $scope.scenarios = s;
            $scope.$applyAsync();
        });
    };

    $scope.addScenario = function() {
        if ($scope.newScenario.title) {
            db.collection('scenarios').add($scope.newScenario).then(function() {
                $scope.newScenario.title = '';
                $scope.loadScenarios();
            });
        }
    };
    $scope.loadScenarios();
}]);
