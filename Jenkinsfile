node('mycloud'){
    git url: 'git@github.com:racker/dreadnot.git', branch: '${BRANCH_NAME}', credentialsId: '8fbc369a-08da-4886-9d8f-9e761356c37f'
    def GIT_SHA = sh (
                script: 'git rev-parse --short HEAD',
                returnStdout: true
            ).trim()
    def img = docker.build("maas-jenkins/dreadnot:${GIT_SHA}", "-f jenkins/Dockerfile .")
    img.inside {
          sh 'cd dreadnot && npm install'
      }
    sh ('git archive --format tar master | gzip > dn-bundle-${GIT_SHA}.tar.gz')
    step([$class: 'ArtifactArchiver', artifacts: '*.tar.gz', fingerprint: true])
    deleteDir()
}
