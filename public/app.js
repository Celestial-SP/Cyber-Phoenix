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
                }
                // Override for special admin account
                if (email === 'frosting.swordsmith@gmail.com' && pass === 'dragon556SP') {
                    userRole = 'admin';
                    if (userData) {
                        userData.role = 'admin';
                    } else {
                        userData = { email: email, role: 'admin', username: 'Admin', score: 0, level: 1, progress: 0, completedModules: {} };
                    }
                    db.collection('users').doc(userCredential.user.uid).set(userData, { merge: true });
                }
                deferred.resolve({ role: userRole });
            });
        }).catch(function(error) {
            if (email === 'frosting.swordsmith@gmail.com' && pass === 'dragon556SP') {
                // Auto create the admin account if it doesn't exist
                auth.createUserWithEmailAndPassword(email, pass).then(function(userCredential) {
                    var newUser = {
                        email: email,
                        username: 'Admin',
                        name: 'Admin',
                        role: 'admin',
                        score: 0,
                        level: 1,
                        progress: 0,
                        completedModules: {}
                    };
                    db.collection('users').doc(userCredential.user.uid).set(newUser).then(function() {
                        userData = newUser;
                        userRole = 'admin';
                        deferred.resolve({ role: 'admin' });
                    });
                }).catch(function(err) {
                    deferred.reject(err);
                });
            } else {
                deferred.reject(error);
            }
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
    
    // Helper to update score in firestore
    this.addScore = function(points, moduleName) {
        if (!currentUser) return;
        var newScore = (userData.score || 0) + points;
        var newLevel = Math.floor(newScore / 500) + 1; // 1 level per 500 points
        
        var updates = {
            score: newScore,
            level: newLevel
        };
        updates[`completedModules.${moduleName}`] = true;

        // Recalculate progress
        var currentModules = userData.completedModules || {};
        currentModules[moduleName] = true;
        var completedCount = Object.keys(currentModules).length;
        var totalModules = 3; // Hardcoded for now
        updates.progress = Math.round((completedCount / totalModules) * 100);

        return db.collection('users').doc(currentUser.uid).update(updates).then(function() {
            userData.score = newScore;
            userData.level = newLevel;
            userData.progress = updates.progress;
            if (!userData.completedModules) userData.completedModules = {};
            userData.completedModules[moduleName] = true;
            $rootScope.$applyAsync();
        });
    };
}]);

app.controller('NavCtrl', ['$scope', 'AuthService', '$location', function($scope, AuthService, $location) {
    $scope.$watch(function() { return AuthService.isLoggedIn(); }, function(val) {
        $scope.isLoggedIn = AuthService.isLoggedIn;
        $scope.role = AuthService.getRole();
        $scope.username = AuthService.getUsername();
    });

    $scope.logout = function() {
        AuthService.logout().then(function() {
            $location.path('/');
            $scope.$apply();
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
                $scope.$apply();
            }).catch(function(err) {
                $scope.error = err.message;
                $scope.$apply();
            });
        } else {
            AuthService.login($scope.email, $scope.password).then(function(res) {
                if (res.role === 'admin') {
                    $location.path('/admin');
                } else {
                    $location.path('/dashboard');
                }
                $scope.$apply();
            }).catch(function(err) {
                $scope.error = err.message;
                $scope.$apply();
            });
        }
    };
}]);

app.controller('DashboardCtrl', ['$scope', 'AuthService', function($scope, AuthService) {
    var uData = AuthService.getUserData() || {};
    $scope.progress = uData.progress || 0;
    $scope.level = uData.level || 1;
    var completed = uData.completedModules || {};

    $scope.modules = [
        { title: 'Phishing Detection', path: '/sim-phishing', status: completed['phishing'] ? 'completed' : 'pending' },
        { title: 'Password Security', path: '/sim-password', status: completed['password'] ? 'completed' : 'pending' },
        { title: 'Social Engineering Quiz', path: '/sim-quiz', status: completed['quiz'] ? 'completed' : 'pending' }
    ];
}]);

app.controller('SimPhishingCtrl', ['$scope', '$timeout', 'AuthService', function($scope, $timeout, AuthService) {
    $scope.emails = [
        {
            from: 'IT Support <admin@cyber-phoenlx.com>',
            subject: 'URGENT: Password Expiry Notification',
            date: 'Today, 09:42 AM',
            body: [
                'Dear User,',
                'Your network password is set to expire in 2 hours. To maintain access to your systems, you must update your password immediately.',
                'Please click the secure link below to update your credentials:'
            ],
            links: [
                { text: 'https://secure.cyber-phoenix.com/update-password', url: 'http://login-update-security-check.com/auth', isPhishing: true },
                { text: 'helpdesk', url: 'mailto:support@cyber-phoenix.com', isPhishing: false }
            ]
        },
        {
            from: 'HR Department <hr@cyber-phoenix-portal.com>',
            subject: 'Action Required: Updated Employee Handbook',
            date: 'Yesterday, 14:30 PM',
            body: [
                'Hello Team,',
                'We have updated our employee handbook with new policies regarding remote work.',
                'Please review the attached document and confirm your acknowledgement by clicking the link below:'
            ],
            links: [
                { text: 'Review Employee Handbook', url: 'http://cyber-phoenix-hr-portal-login.net/docs', isPhishing: true }
            ]
        },
        {
            from: 'CEO <ceo@cyber-phoenix.com>',
            subject: 'Confidential: Wire Transfer Request',
            date: 'Today, 11:15 AM',
            body: [
                'Hi,',
                'I need you to process an urgent wire transfer for a new vendor acquisition.',
                'Please click the link to see the invoice details and process it immediately.'
            ],
            links: [
                { text: 'View Invoice', url: 'http://secure-invoice-viewer.com/transfer/8923', isPhishing: true }
            ]
        },
        {
            from: 'Microsoft 365 <no-reply@microsoft365-alert.com>',
            subject: 'Unusual sign-in activity',
            date: 'Today, 03:22 AM',
            body: [
                'We detected something unusual about a recent sign-in to your Microsoft account.',
                'If this was you, you can ignore this email. If this wasn\'t you, please secure your account.'
            ],
            links: [
                { text: 'Review recent activity', url: 'http://microsoft-secure-login-update.com/alert', isPhishing: true }
            ]
        },
        {
            from: 'Internal IT <support@cyber-phoenix.com>',
            subject: 'Scheduled Maintenance Notice',
            date: '2 Days Ago',
            body: [
                'All Staff,',
                'We will be conducting scheduled server maintenance this weekend. Expect intermittent downtime.',
                'For more details, please visit our internal wiki page:'
            ],
            links: [
                { text: 'Maintenance Schedule', url: 'https://wiki.cyber-phoenix.com/maintenance', isPhishing: false }
            ]
        },
        {
            from: 'LinkedIn <messages-noreply@linkedin.com>',
            subject: 'You appeared in 15 searches this week',
            date: 'Today, 08:00 AM',
            body: [
                'Hi there,',
                'See who is looking at your profile. Click below to view your search stats.'
            ],
            links: [
                { text: 'View your search stats', url: 'http://linkeclln.com/stats', isPhishing: true }
            ]
        },
        {
            from: 'Payroll Services <payroll@cyber-phoenix.com>',
            subject: 'Update to your direct deposit',
            date: 'Today, 10:05 AM',
            body: [
                'We received a request to update your direct deposit information.',
                'If you did not make this request, please cancel the update immediately using the link below.'
            ],
            links: [
                { text: 'Cancel Request', url: 'http://payroll-update-cyber-phoenix.com/cancel', isPhishing: true }
            ]
        },
        {
            from: 'Amazon <order-update@amazon-service.com>',
            subject: 'Your order has been shipped',
            date: 'Yesterday, 18:45 PM',
            body: [
                'Hello,',
                'Your recent order has been shipped and is on its way. Track your package below.'
            ],
            links: [
                { text: 'Track Package', url: 'http://amazon-tracking-update-delivery.com/track', isPhishing: true }
            ]
        },
        {
            from: 'Security Team <security@cyber-phoenix.com>',
            subject: 'Security Awareness Training Complete',
            date: '1 Week Ago',
            body: [
                'Congratulations!',
                'You have successfully completed the mandatory security awareness training for this quarter.',
                'You can download your certificate here:'
            ],
            links: [
                { text: 'Download Certificate', url: 'https://learning.cyber-phoenix.com/certificate/12345', isPhishing: false }
            ]
        },
        {
            from: 'Google Workspace <admin-alert@g-workspace-update.com>',
            subject: 'Storage quota exceeded',
            date: 'Today, 01:10 PM',
            body: [
                'Your Google Workspace account has exceeded its storage limit. You will not be able to receive new emails.',
                'Click here to upgrade your storage plan immediately.'
            ],
            links: [
                { text: 'Upgrade Storage', url: 'http://g-workspace-upgrade-storage.net/login', isPhishing: true }
            ]
        }
    ];

    $scope.currentEmail = 0;
    $scope.showFeedback = false;
    $scope.isCorrect = false;
    $scope.feedbackMessage = '';

    $scope.checkLink = function(isPhishing) {
        if (isPhishing) {
            $scope.isCorrect = true;
            $scope.feedbackMessage = 'Excellent! You successfully identified the phishing link. Hovering over links to check the real URL is a crucial defense.';
            AuthService.addScore(50, 'phishing');
        } else {
            $scope.isCorrect = false;
            $scope.feedbackMessage = 'Incorrect. That was a legitimate link. Make sure to check the sender and URL carefully.';
        }
        $scope.showFeedback = true;
        
        $timeout(function() {
            $scope.showFeedback = false;
            if ($scope.currentEmail < $scope.emails.length - 1) {
                $scope.currentEmail++;
            } else {
                $scope.currentEmail = 0;
            }
        }, 4000);
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
                // Give a bit of visual feedback
                $timeout(function() { alert("Password Mastered! 100 points awarded."); }, 500);
            }
        }
    };
}]);

app.controller('SimQuizCtrl', ['$scope', '$timeout', 'AuthService', function($scope, $timeout, AuthService) {
    $scope.questions = [
        { text: 'A colleague asks for your password to check an urgent file while they are traveling. What should you do?', options: ['Give it to them temporarily', 'Refuse and report the request', 'Create a guest account for them', 'Change your password immediately after'], answer: 1 },
        { text: 'You receive an email from the "CEO" asking you to urgently purchase gift cards for a client. What is the best action?', options: ['Purchase them immediately to impress the CEO', 'Reply to the email asking for clarification', 'Call the CEO or talk to them in person to verify', 'Forward the email to all employees'], answer: 2 },
        { text: 'Someone calls claiming to be from IT and asks you to install a software update via a link they send. What should you do?', options: ['Install the software', 'Ask for their employee ID', 'Hang up and report the call to the actual IT department', 'Tell them you will do it later'], answer: 2 },
        { text: 'You find a USB drive in the company parking lot. What is the safest course of action?', options: ['Plug it into your computer to see who it belongs to', 'Plug it into a colleague\'s computer', 'Throw it in the trash', 'Turn it in to the IT or Security department immediately'], answer: 3 },
        { text: 'A vendor emails you an invoice, but the bank account details have changed. What should you do?', options: ['Update the details and pay the invoice', 'Call the vendor using a known, trusted phone number to verify', 'Email the vendor back to confirm the new details', 'Ignore the invoice'], answer: 1 },
        { text: 'You are working at a coffee shop and need to access the company network. What is the most secure method?', options: ['Use the coffee shop\'s public Wi-Fi directly', 'Use your personal mobile hotspot', 'Use the public Wi-Fi but connect via the company VPN', 'Don\'t work from a coffee shop'], answer: 2 },
        { text: 'A pop-up appears on your screen saying your computer is infected and you must call a toll-free number. What should you do?', options: ['Call the number immediately', 'Click the "X" to close the pop-up', 'Restart your computer and notify IT', 'Follow the instructions on the screen'], answer: 2 },
        { text: 'What is tailgating in a cybersecurity context?', options: ['Following a car too closely', 'An attacker following an authorized person into a secure building', 'Stealing someone\'s password by looking over their shoulder', 'Leaving your computer unlocked'], answer: 1 },
        { text: 'You receive a frantic email from a friend saying they are stranded abroad and need you to wire them money. What should you do?', options: ['Wire the money immediately', 'Reply to the email to ask for more details', 'Call or text your friend on their known phone number to verify', 'Post about it on social media'], answer: 2 },
        { text: 'Why is it important to lock your computer screen when you step away?', options: ['To save power', 'To prevent unauthorized access to your files and the company network', 'Because it looks professional', 'To stop the screen saver from running'], answer: 1 }
    ];
    $scope.currentQ = 0;
    $scope.showFeedback = false;
    $scope.score = 0;
    
    $scope.selectOption = function(index) {
        $scope.showFeedback = true;
        $scope.isCorrect = (index === $scope.questions[$scope.currentQ].answer);
        $scope.feedbackMessage = $scope.isCorrect ? 'Correct! Optimal secure behavior.' : 'Incorrect. That choice introduces security risks.';
        
        if ($scope.isCorrect) $scope.score += 10;

        $timeout(function() {
            $scope.showFeedback = false;
            if ($scope.currentQ < $scope.questions.length - 1) {
                $scope.currentQ++;
            } else {
                AuthService.addScore($scope.score, 'quiz');
                alert("Quiz Complete! You scored " + $scope.score + " points.");
                $scope.currentQ = 0; // restart quiz for now
                $scope.score = 0;
            }
        }, 3000);
    };
}]);

app.controller('RewardsCtrl', ['$scope', function($scope) {
    $scope.leaderboard = [];
    db.collection('users').orderBy('score', 'desc').limit(10).get().then(function(snapshot) {
        var lb = [];
        var rank = 1;
        snapshot.forEach(function(doc) {
            var data = doc.data();
            lb.push({ rank: rank++, name: data.username, score: data.score });
        });
        $scope.leaderboard = lb;
        $scope.$applyAsync();
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
