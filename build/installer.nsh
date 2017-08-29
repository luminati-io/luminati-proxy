!macro customInstall
  CreateShortCut "$startMenuLink" "%comspec%" "/C $\"$appExe$\"" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
  CreateShortCut "$desktopLink" "%comspec%" "/C $\"$appExe$\"" $appExe" 0 "" "" "${APP_DESCRIPTION}"
!macroend
