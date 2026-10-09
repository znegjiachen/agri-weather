@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup script for Windows
@REM ----------------------------------------------------------------------------
@if "%DEBUG%"=="" @echo off
@setlocal

set MAVEN_PROJECTBASEDIR=%MAVEN_BASEDIR%
if not "%MAVEN_PROJECTBASEDIR%"=="" set MAVEN_HOME=%MAVEN_PROJECTBASEDIR%
set "MAVEN_USER_HOME=%USERPROFILE%\.m2"
set "MVNW_REPOURL=https://repo.maven.apache.org/maven2"
set "MAVEN_OPTS=-Xmx1024m"

if not "%JAVA_HOME%"=="" (
    set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
) else (
    set "JAVA_EXE=java"
)

set "WRAPPER_JAR=%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar"
set "WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain"

%JAVA_EXE% %MAVEN_OPTS% -classpath "%WRAPPER_JAR%" %WRAPPER_LAUNCHER% %*
@endlocal
