
!macro customInstall
  CreateShortCut "$starztMenuLink" "%comspec%" "/C $\"$appExe$\"" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
  CreateShortCut "$desktopLink" "%comspec%" "/C $\"$appExe$\"" $appExe" 0 "" "" "${APP_DESCRIPTION}"
!macroend
