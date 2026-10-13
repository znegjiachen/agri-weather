@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup script for Windows
@REM ----------------------------------------------------------------------------
@if "%DEBUG%"=="" @echo off
@setlocal

@REM Project base dir is the directory holding this script. %~dp0 ends with a
@REM trailing backslash, which must be stripped (a trailing \ before a closing
@REM quote would escape it when passed as -D...=%MAVEN_PROJECTBASEDIR%).
set "MAVEN_PROJECTBASEDIR=%~dp0"
if "%MAVEN_PROJECTBASEDIR:~-1%"=="\" set "MAVEN_PROJECTBASEDIR=%MAVEN_PROJECTBASEDIR:~0,-1%"

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

"%JAVA_EXE%" %MAVEN_OPTS% -classpath "%WRAPPER_JAR%" "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" %WRAPPER_LAUNCHER% %*
@endlocal
