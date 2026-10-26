; Registers Lumen with Windows so it shows up under Settings > Default apps
; and can open web links and .html files.
!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\LumenURL" "" "Lumen URL"
  WriteRegStr SHELL_CONTEXT "Software\Classes\LumenURL" "URL Protocol" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\LumenURL\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\LumenURL\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr SHELL_CONTEXT "Software\Classes\LumenHTML" "" "Lumen HTML Document"
  WriteRegStr SHELL_CONTEXT "Software\Classes\LumenHTML\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\LumenHTML\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr SHELL_CONTEXT "Software\Clients\StartMenuInternet\Lumen" "" "Lumen"
  WriteRegStr SHELL_CONTEXT "Software\Clients\StartMenuInternet\Lumen\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHELL_CONTEXT "Software\Clients\StartMenuInternet\Lumen\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  WriteRegStr SHELL_CONTEXT "Software\Clients\StartMenuInternet\Lumen\Capabilities" "ApplicationName" "Lumen"
  WriteRegStr SHELL_CONTEXT "Software\Clients\StartMenuInternet\Lumen\Capabilities" "ApplicationDescription" "A fast browser with a Liquid Glass toolbar"
  WriteRegStr SHELL_CONTEXT "Software\Clients\StartMenuInternet\Lumen\Capabilities\URLAssociations" "http" "LumenURL"
  WriteRegStr SHELL_CONTEXT "Software\Clients\StartMenuInternet\Lumen\Capabilities\URLAssociations" "https" "LumenURL"
  WriteRegStr SHELL_CONTEXT "Software\Clients\StartMenuInternet\Lumen\Capabilities\FileAssociations" ".html" "LumenHTML"
  WriteRegStr SHELL_CONTEXT "Software\Clients\StartMenuInternet\Lumen\Capabilities\FileAssociations" ".htm" "LumenHTML"
  WriteRegStr SHELL_CONTEXT "Software\RegisteredApplications" "Lumen" "Software\Clients\StartMenuInternet\Lumen\Capabilities"
!macroend

!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "Software\Classes\LumenURL"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\LumenHTML"
  DeleteRegKey SHELL_CONTEXT "Software\Clients\StartMenuInternet\Lumen"
  DeleteRegValue SHELL_CONTEXT "Software\RegisteredApplications" "Lumen"
!macroend
