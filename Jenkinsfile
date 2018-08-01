node('mycloud'){
    properties([
      parameters([
        string(name: 'DN_VERION', defaultValue: '0.2.4')
      ])
    ])
    git url: 'git@github.com:racker/dreadnot.git', branch: '${BRANCH_NAME}', credentialsId: '8fbc369a-08da-4886-9d8f-9e761356c37f'
    def GIT_SHA = sh (
                script: 'git rev-parse --short HEAD',
                returnStdout: true
            ).trim()
    def img = docker.build("maas-jenkins/dreadnot-deb:${GIT_SHA}", "-f jenkins/Dockerfile .")
    withEnv(["DN_VERION=$DN_VERION"]){
      img.inside {
          sh '''
          mkdir -p installdir/opt && cp -r /opt/dreadnot installdir/opt/
          chmod a+rx -R installdir/
          fpm -s dir -t deb --name=dreadnot --version=${DN_VERION} -C installdir/  \
            --package=dreadnot_${DN_VERION}.deb \
            --maintainer=ele-dev@lists.rackspace.com  \
            --deb-user=root \
            --deb-group=root  \
            opt/
          '''
      }
    }
    step([$class: 'ArtifactArchiver', artifacts: '*.deb', fingerprint: true])
    deleteDir()
}
