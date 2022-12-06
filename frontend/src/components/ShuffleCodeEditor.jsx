import React, {useState, useEffect, useLayoutEffect} from 'react';
import {
	CircularProgress, 
	IconButton,
	Dialog, 
	Modal, 
	Tooltip,
	DialogTitle, 
	DialogContent,
	Typography,
	Paper,
	Menu,
	MenuItem,
	Button,
} from '@material-ui/core';

import Checkbox from '@mui/material/Checkbox';
import { orange } from '@mui/material/colors';
import { isMobile } from "react-device-detect" 
import { GetParsedPaths, FindJsonPath } from "../views/Apps.jsx";
import NestedMenuItem from "material-ui-nested-menu-item";

import {
	FullscreenExit as FullscreenExitIcon,
	Extension as ExtensionIcon, 
  Apps as AppsIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Schedule as ScheduleIcon,
  FormatListNumbered as FormatListNumberedIcon,
	SquareFoot as SquareFootIcon,
  Circle as  CircleIcon,
  Add as AddIcon,
	PlayArrow as PlayArrowIcon, 
} from '@mui/icons-material';

import {
	AutoFixHigh as AutoFixHighIcon, CompressOutlined, QrCodeScannerOutlined,
} from '@mui/icons-material';

import { useTheme } from '@material-ui/core/styles';
import { validateJson } from "../views/Workflows.jsx";
import ReactJson from "react-json-view";
import PaperComponent from "../components/PaperComponent.jsx";

import CodeMirror from '@uiw/react-codemirror';
import 'codemirror/keymap/sublime';
import 'codemirror/addon/selection/mark-selection.js'
import 'codemirror/theme/gruvbox-dark.css';
import 'codemirror/theme/duotone-light.css';
import { padding, textAlign } from '@mui/system';
import data from '../frameworkStyle.jsx';
import { useNavigate, Link, useParams } from "react-router-dom";

const liquidFilters = [
	{"name": "Size", "value": "size", "example": ""},
	{"name": "Date", "value": `date: "%Y%m%d"`, "example": `{{ "now" | date: "%s" }}`},
	{"name": "Escape String", "value": `{{ \"\"\"'string with weird'" quotes\"\"\" | escape_string }}`, "example": ``},
	{"name": "Flatten", "value": `flatten`, "example": `{{ [1, [1, 2], [2, 3, 4]] | flatten }}`},
]

const mathFilters = [
	{"name": "Plus", "value": "plus: 1", "example": `{{ "1" | plus: 1 }}`},
	{"name": "Minus", "value": "minus: 1", "example": `{{ "1" | minus: 1 }}`},
]

const pythonFilters = [
	{"name": "Hello World", "value": `{% python %}\nprint("hello world")\n{% endpython %}`, "example": ``},
	{"name": "Handle JSON", "value": `{% python %}\nimport json\njsondata = json.loads(r"""$nodename""")\n{% endpython %}`, "example": ``},
]

const CodeEditor = (props) => {
	const { globalUrl, fieldCount, setFieldCount, actionlist, changeActionParameterCodeMirror, expansionModalOpen, setExpansionModalOpen, codedata, setcodedata, isFileEditor, runUpdateText } = props

	const [localcodedata, setlocalcodedata] = React.useState(codedata === undefined || codedata === null || codedata.length === 0 ? "" : codedata);
  	// const {codelang, setcodelang} = props
  const theme = useTheme();
	const [validation, setValidation] = React.useState(false);
	const [expOutput, setExpOutput] = React.useState(" ");
	const [linewrap, setlinewrap] = React.useState(true);
	const [codeTheme, setcodeTheme] = React.useState("gruvbox-dark");
	const [editorPopupOpen, setEditorPopupOpen] = React.useState(false);

	const [currentCharacter, setCurrentCharacter] = React.useState(-1);
	const [currentLine, setCurrentLine] = React.useState(-1);

	const [variableOccurences, setVariableOccurences] = React.useState([]);
	const [currentLocation, setCurrentLocation] = React.useState([]);
	const [currentVariable, setCurrentVariable] = React.useState("");
	const [anchorEl, setAnchorEl] = React.useState(null);
	const [anchorEl2, setAnchorEl2] = React.useState(null);
	const [anchorEl3, setAnchorEl3] = React.useState(null);
	const [mainVariables, setMainVariables] = React.useState([]);
	const [availableVariables, setAvailableVariables] = React.useState([]);

  const [menuPosition, setMenuPosition] = useState(null);
  const [showAutocomplete, setShowAutocomplete] = React.useState(false);

	const baseResult = ""
	const [executionResult, setExecutionResult] = useState({
		"valid": false,		
		"result": baseResult,
	})
	const [executing, setExecuting] = useState(false)

	const liquidOpen = Boolean(anchorEl);
	const mathOpen = Boolean(anchorEl2);
	const pythonOpen = Boolean(anchorEl3);

	const handleMenuClose = () => {
		setShowAutocomplete(false);

		setMenuPosition(null);
	}

	let navigate = useNavigate();
	// console.log("is it file editor? - ", isFileEditor);

	useEffect(() => {
		var allVariables = []
		var tmpVariables = []

		if (actionlist === undefined || actionlist === null) {
			return
		}

		for(var i=0; i < actionlist.length; i++){
			allVariables.push('$'+actionlist[i].autocomplete.toLowerCase())
			tmpVariables.push('$'+actionlist[i].autocomplete.toLowerCase())

			var parsedPaths = []
			if (typeof actionlist[i].example === "object") {
				parsedPaths = GetParsedPaths(actionlist[i].example, "");
			}

			for (var key in parsedPaths) {
				const fullpath = "$"+actionlist[i].autocomplete.toLowerCase()+parsedPaths[key].autocomplete
				if (!allVariables.includes(fullpath)) {
					allVariables.push(fullpath)
				}
			}
		}

		setAvailableVariables(allVariables)
		setMainVariables(tmpVariables)
	}, [])

	const autoFormat = (input) => {
		if (validation !== true) {
			return
		}

		try {
			input = JSON.stringify(JSON.parse(input), null, 4)
		} catch (e) {
			console.log("Failed magic JSON stringification: ", e)
		}

		if (input !== localcodedata) {
			setlocalcodedata(input)
		}
	}

	const findIndex = (line, loc) => {
		// var temp_arr = []
		// for(var i=0; i<string.length; i++) {
		// 	if (string[i] === "$") temp_arr.push(i);
		// }
		// return temp_arr
		// var line = currentLine
		// var loc = currentCharacter
		// console.log(line)
		// console.log(loc)
		var code_line = localcodedata.split('\n')[line]
		var dollar_occurences = []
		var dollar_occurences_len = []
		var variable_ranges = []
		var popup = false

		for(var ch=0; ch<code_line.length; ch++){
			if(code_line[ch] === '$'){
				dollar_occurences.push(ch)
			}
		}

		var variable_occurences = code_line.match(/[$]{1}([a-zA-Z0-9_-]+\.?){1}([a-zA-Z0-9#_-]+\.?){0,}/g)

		try{
			for(var occ = 0; occ < variable_occurences.length; occ++){
				dollar_occurences_len.push(variable_occurences[occ].length)
			}
		} catch (e) {}

		for(var occ = 0; occ < dollar_occurences.length; occ++){
			// var temp_arr = []
			// for(var occ_len = 0; occ_len<dollar_occurences_len[occ]; occ_len++){
			// 	temp_arr.push(dollar_occurences[occ]+occ_len)
			// }
			// if(temp_arr === []){temp_arr=[dollar_occurences[occ]]}
			// temp_arr.push(temp_arr[temp_arr.length-1]+1)
			// variable_ranges.push(temp_arr)
			var temp_arr = [dollar_occurences[occ]]
			for(var occ_len = 0; occ_len < dollar_occurences_len[occ]; occ_len++){
				temp_arr.push(dollar_occurences[occ]+occ_len+1)
			}

			if(temp_arr.length==1) {
				temp_arr.push(temp_arr[temp_arr.length-1]+1)
			}
			variable_ranges.push(temp_arr)
		}

		for(var occ = 0; occ<variable_ranges.length; occ++){
			for(var occ1 = 0; occ1<variable_ranges[occ].length; occ1++){
				// console.log(variable_ranges[occ][occ1])
				if(loc === variable_ranges[occ][occ1]){
					popup = true
					setCurrentLocation([line, dollar_occurences[occ]])

					try{
						setCurrentVariable(variable_occurences[occ])

					} catch (e) {
						// setCurrentVariable("")
						// console.log("Current Variable : Nothing")
					}

					occ = Infinity
					break
				}
			}
		}
		setEditorPopupOpen(popup)

		// console.log(variable_occurences)
		// console.log(dollar_occurences_len)
		// console.log(variable_ranges)
		// console.log(dollar_occurences)
	}

	const fixVariable = (inputvariable) => {
		if (inputvariable === undefined || inputvariable === null) {
			return inputvariable
		}

		if (!inputvariable.includes(".")) {
			return inputvariable
		}

		const itemsplit = inputvariable.split(".")
		var newitem = []
		var removedIndexes = 0
		for (var key in itemsplit) {
			var tmpitem = itemsplit[key]
			if (tmpitem.startsWith("#")) {
				removedIndexes += tmpitem.length-1
				tmpitem = "#"
			}

			newitem.push(tmpitem)
		}

		//console.log("Fixed item: ", newitem, "removed length: ", removedIndexes)

		return newitem.join(".")
		//return inputvariable
	}

	const highlight_variables = (value) => {
		// value.markText({line:0, ch:2}, {line:0, ch:8}, {"css": "background-color: #f85a3e; border-radius: 4px; color: white"})
		// value.markText({line:0, ch:13}, {line:0, ch:15}, {"css": "background-color: #f85a3e; border-radius: 4px; color: white"})
		// value.markText({line:0, ch:19}, {line:0, ch:26}, {"css": "background-color: #f85a3e; border-radius: 4px; color: white"})
		// value.markText({line:0, ch:31}, {line:0, ch:35}, {"css": "background-color: #f85a3e; border-radius: 4px; color: white"})
		// value.markText({line:0, ch:69}, {line:0, ch:73}, {"css": "background-color: #f85a3e; border-radius: 4px; color: white"})

		// var code_variables = value.getValue().match(/[$]{1}([a-zA-Z0-9_-]+\.?){1}([a-zA-Z0-9#_-]+\.?){0,}/g)
		// console.log(code_variables)
		
		// var regex = /[$]{1}([a-zA-Z0-9_-]+\.?){1}([a-zA-Z0-9#_-]+\.?){0,}/g
		// var code_variables_loc = regex.exec(value.getValue())
		// console.log(code_variables_loc)
		// while ((code_variables_loc = regex.exec(value.getValue())) != null) {
		// 	console.log(code_variables_loc);
		// }
		// var code_variables_loc = regex.exec(value.getValue())
		// console.log(code_variables_loc)

		var code_lines = localcodedata.split('\n')
		for (var i = 0; i < code_lines.length; i++){
			var current_code_line = code_lines[i]
			// console.log(current_code_line)

			var variable_occurence = current_code_line.match(/[\\]{0,1}[$]{1}([a-zA-Z0-9_-]+\.?){1}([a-zA-Z0-9#_-]+\.?){0,}/g)

			if (variable_occurence === null || variable_occurence === undefined) {
				console.log("No variables found. Returning")
				continue
			}

			var new_occurences = []
			for (var key in variable_occurence) {
				if (variable_occurence[key][0] !== "\\") {
					new_occurences.push(variable_occurence[key])
				}
			}

			variable_occurence = new_occurences.valueOf()
			console.log("Match2: ", variable_occurence)
			// console.log(variable_occurence)
			// console.log()

			// for (var j = 0; j < actionlist.length; j++) {
			// 	if(found[i].slice(1,).toLowerCase() === actionlist[j].autocomplete.toLowerCase()){
			// 		input = input.replace(found[i], JSON.stringify(actionlist[j].example));
			// 		console.log(input)
			// 		console.log(actionlist[j].example)
			// 	}
			// 	console.log(actionlist[j].autocomplete);
			// }

			// Finds occurences of dollar signs
			var dollar_occurence = []
			for(var ch = 0; ch < current_code_line.length; ch++){
				if (current_code_line[ch] === '$' && (ch === 0 || current_code_line[ch-1] !== "\\")) {
					dollar_occurence.push(ch)
				}
			}
			//console.log(dollar_occurence)

			var dollar_occurence_len = []
			try{
				for(var occ = 0; occ < variable_occurence.length; occ++){
					dollar_occurence_len.push(variable_occurence[occ].length)
				}
			} catch (e) {}

			//console.log("VARIABLES: ", availableVariables)


			try{
				if (variable_occurence.length === 0) {
					//value.markText({line:i, ch:0}, {line:i, ch:code_lines[i].length-1}, {"css": "background-color: #282828; border-radius: 0px; color: #b8bb26"})
					//value.markText({line:i, ch:0}, {line:i, ch:code_lines[i].length-1}, {"css": "background-color: #; border-radius: 0px; color: inherit"})
				}

				// console.log(variable_occurence)
				for (var occ = 0; occ < variable_occurence.length; occ++){
					// value.markText({line:i, ch:dollar_occurence[occ]}, {line:i, ch:dollar_occurence_len[occ]+dollar_occurence[occ]}, {"css": "background-color: #8b8e26; border-radius: 4px; color: white"})
					// var correctVariable = actionlist.find(action => action.autocomplete.toLowerCase() === variable_occurence[occ].slice(1,).toLowerCase())
					const fixedVariable = fixVariable(variable_occurence[occ])
					var correctVariable = availableVariables.includes(fixedVariable)
					if(!correctVariable) {
						value.markText({line:i, ch:dollar_occurence[occ]}, {line:i, ch:dollar_occurence_len[occ]+dollar_occurence[occ]}, {"css": "background-color: rgb(248, 106, 62, 0.9); padding-top: 2px; padding-bottom: 2px; color: white"})
					}
					else{
						value.markText({line:i, ch:dollar_occurence[occ]}, {line:i, ch:dollar_occurence_len[occ]+dollar_occurence[occ]}, {"css": "background-color: #8b8e26; padding-top: 2px; padding-bottom: 2px; color: white"})
					}
					// console.log(correctVariables)
				}
			} catch (e) {
				console.log("Error in color highlighting: ", e)
			}
		}
	}

	// function findlocation(arr) {
	// 	for(var i=0; i<arr.length; i++) {
	// 		if (arr[i] != variableOccurences[i]){
	// 			return arr[i]
	// 		};
	// 	}
	// 	return null
	// }

	// function findVariables(string){
	// 	if (currentLocation != -1){
	// 		return string.slice(currentLocation+1).match(/[a-zA-Z0-9_.#-]*/g)[0]
	// 	}
	// 	return ""
	// }

	const replaceVariables = (swapVariable) => {
		// var updatedCode = localcodedata.slice(0,index) + "$" + str + localcodedata.slice(index+currentVariable.length+1,)
		// setlocalcodedata(updatedCode)
		// setEditorPopupOpen(false)
		// setCurrentLocation(0)
		// console.log(index)
		// console.log(currentLocation)

		var code_lines = localcodedata.split('\n')
		var parsedVariable = currentVariable
		if (currentVariable === undefined || currentVariable === null) {
			console.log("Location: ", currentLocation)
			parsedVariable= "$"
		}

		code_lines[currentLine] = code_lines[currentLine].slice(0,currentLocation[1]) + "$" + swapVariable + code_lines[currentLine].slice(currentLocation[1]+parsedVariable.length,)
		// console.log(code_lines)
		var updatedCode = code_lines.join('\n')
		// console.log(updatedCode)
		setlocalcodedata(updatedCode)
	}

	const expectedOutput = (input) => {
		
		//const found = input.match(/[$]{1}([a-zA-Z0-9_-]+\.?){1}([a-zA-Z0-9#_-]+\.?){0,}/g)
		const found = input.match(/[$]{1}([a-zA-Z0-9_-]+\.?){1}([a-zA-Z0-9#_-]+\.?){0,}/g)
		//if (found === null || found === undefined) {
		//	console.log("No output found!")
		//	return
		//}

		console.log("FOUND: ", found)

		// Whelp this is inefficient af. Single loop pls
		// When the found array is empty.
		try { 
			for (var i = 0; i < found.length; i++) {
				try {
					//found[i] = found[i].toLowerCase()
					const fixedVariable = fixVariable(found[i])
					//var correctVariable = availableVariables.includes(fixedVariable)

					// 
					var valuefound = false
					for (var j = 0; j < actionlist.length; j++) {
						if(fixedVariable.slice(1,).toLowerCase() === actionlist[j].autocomplete.toLowerCase()){
							valuefound = true 

							console.log("Valuefound: ", fixedVariable, actionlist[j].example)

							try {
								if (actionlist[j].example.trim().startsWith("{") || actionlist[j].example.trim().startsWith("[")) {
									input = input.replace(fixedVariable, JSON.stringify(actionlist[j].example));
								} else {
									input = input.replace(fixedVariable, actionlist[j].example)
								}
							} catch (e) { 
								input = input.replace(fixedVariable, actionlist[j].example)
							}
						} else {
						}
					}

					if (!valuefound && availableVariables.includes(fixedVariable)) {
						var shouldbreak = false
						for (var k=0; k < actionlist.length; k++){
							var parsedPaths = []
							if (typeof actionlist[k].example === "object") {
								parsedPaths = GetParsedPaths(actionlist[k].example, "");
							}

							for (var key in parsedPaths) {
								const fullpath = "$"+actionlist[k].autocomplete.toLowerCase()+parsedPaths[key].autocomplete
								if (fullpath === fixedVariable) {
									//if (actionlist[k].example === undefined) {
									//	actionlist[k].example = "TMP"
									//}

									var new_input = ""
									try {
										new_input = FindJsonPath(fullpath, actionlist[k].example)
									} catch (e) {
										console.log("ERR IN INPUT: ", e)
									}

									//console.log("Got output for: ", fullpath, new_input, actionlist[k].example, typeof new_input)

									if (typeof new_input === "object") {
										new_input = JSON.stringify(new_input)
									} else {
										if (typeof new_input === "string") {
											new_input = new_input
										} else {
											console.log("NO TYPE? ", typeof new_input)
											try {
												new_input = new_input.toString()
											} catch (e) {
												new_input = ""
											}
										}
									}

									//console.log("FOUND2: ", fixedVariable, actionlist[j].example)
									input = input.replace(fixedVariable, new_input)

									//} catch (e) {
									//	input = input.replace(found[i], actionlist[k].example)
									//}

									shouldbreak = true 
									break
								}
							}

							if (shouldbreak) {
								break
							}
						}
					}
				} catch (e) {
					console.log("Replace error: ", e)
				}
			}
		} catch (e) {
			console.log("Outer replace error: ", e)
		}

		const tmpValidation = validateJson(input.valueOf())
		//setValidation(true)
		if (tmpValidation.valid === true) {
			setValidation(true)
			setExpOutput(tmpValidation.result)
		} else {
			setExpOutput(input.valueOf())
			setValidation(false)
		}
	}

  const handleItemClick = (values) => {
		if (
			values === undefined ||
			values === null ||
			values.length === 0
		) {
			return;
		}

		var toComplete = localcodedata.trim().endsWith("$") ? values[0].autocomplete : "$" + values[0].autocomplete;

		toComplete = toComplete.toLowerCase().replaceAll(" ", "_");
		for (var key in values) {
			if (key == 0 || values[key].autocomplete.length === 0) {
				continue;
			}

			toComplete += values[key].autocomplete;
		}

		setlocalcodedata(localcodedata+toComplete)
		setMenuPosition(null)
	}

	const handleClick = (item) => {
		if (item === undefined || item.value === undefined || item.value === null) {
			return
		}

		if (!item.value.includes("{%") && !item.value.includes("{{")) {
			setlocalcodedata(localcodedata+" | "+item.value+" }}")
		} else {
			setlocalcodedata(localcodedata+item.value)
		}

		setAnchorEl(null)
		setAnchorEl2(null)
		setAnchorEl3(null)
	}

	const executeSingleAction = (inputdata) => {
		//if (serverside === true) {
		//	return
		//}
	
		if (validation === true) {
			inputdata = JSON.stringify(inputdata)
		}

		const appid = "3e2bdf9d5069fe3f4746c29d68785a6a" 
		const actiondata = {"description":"Repeats the call parameter","id":"","name":"repeat_back_to_me","label":"","node_type":"","environment":"","sharing":false,"private_id":"","public_id":"","app_id":"3e2bdf9d5069fe3f4746c29d68785a6a","tags":null,"authentication":[],"tested":false,"parameters":[{"description":"The message to repeat","id":"","name":"call","example":"REPEATING: Hello world","value":inputdata,"multiline":true,"options":null,"action_field":"","variant":"STATIC_VALUE","required":true,"configuration":false,"tags":null,"schema":{"type":"string"},"skip_multicheck":false,"value_replace":null,"unique_toggled":false,"autocompleted":false}],"execution_variable":{"description":"","id":"","name":"","value":""},"returns":{"description":"","example":"","id":"","schema":{"type":"string"}},"authentication_id":"","example":"","auth_not_required":false,"source_workflow":"","run_magic_output":false,"run_magic_input":false,"execution_delay":0,"app_name":"Shuffle Tools","app_version":"1.2.0","selectedAuthentication":{}}

		setExecutionResult({
			"valid": false,		
			"result": baseResult,
		})

		setExecuting(true)

		fetch(globalUrl+"/api/v1/apps/"+appid+"/execute", {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: JSON.stringify(actiondata),
			credentials: "include",
		})
		.then((response) => {
			if (response.status !== 200) {
				console.log("Status not 200 for stream results :O!")
			}

			return response.json()
		})
		.then((responseJson) => {
			//console.log("RESPONSE: ", responseJson)
			if (responseJson.success === true && responseJson.result !== null && responseJson.result !== undefined && responseJson.result.length > 0) {
				const result = responseJson.result.slice(0, 50)+"..."
				//alert.info("SUCCESS: "+result)

				const validate = validateJson(responseJson.result)
				setExecutionResult(validate)
			} else if (responseJson.success === false && responseJson.reason !== undefined && responseJson.reason !== null) {
				alert.error(responseJson.reason)
				setExecutionResult({"valid": false, "result": responseJson.reason})
			} else if (responseJson.success === true) {
				setExecutionResult({"valid": false, "result": "Couldn't finish execution. Please fill all the required fields, and retry the execution."})
			} else {
				setExecutionResult({"valid": false, "result": "Couldn't finish execution (2). Please fill all the required fields, and validate the execution."})
			}
			
			setExecuting(false)
		})
		.catch(error => {
			//alert.error("Execution error: "+error.toString())
			console.log("error: ", error)
			setExecuting(false)
		})
	}

	return (
		<Dialog
			aria-labelledby="draggable-code-modal"
			disableBackdropClick={true}
			disableEnforceFocus={true}
      //style={{ pointerEvents: "none" }}
			hideBackdrop={true}
			open={expansionModalOpen}
			onClose={() => {
				console.log("In closer")

				if (changeActionParameterCodeMirror !== undefined) {
					changeActionParameterCodeMirror({target: {value: ""}}, fieldCount, localcodedata)
				} else {
					console.log("No action called changeActionParameterCodeMirror in code editor")
				}
				//setExpansionModalOpen(false)
			}}
			PaperComponent={PaperComponent}
			PaperProps={{
				style: {
					backgroundColor: theme.palette.surfaceColor,
					color: "white",
					minWidth: isMobile ? "100%" : 600,
					padding: isMobile ? "25px 10px 25px 10px" : 25,
					border: theme.palette.defaultBorder,
					zIndex: 10012,
				},
			}}
		>
		{ isFileEditor ? 
			<div
			style={{
				display: 'flex',
			}}
		>
			<div style={{display: "flex"}}>
				<DialogTitle
					id="draggable-dialog-title"
					style={{
						cursor: "move",
						paddingBottom:20,
						paddingLeft: 10, 
					}}
				>
						File Editor
				</DialogTitle> 
			</div>
		</div>	
			:
			<div
				style={{
					display: 'flex',
				}}
			>
				<div style={{display: "flex"}}>
					<DialogTitle
						id="draggable-dialog-title"
						style={{
							cursor: "move",
							paddingBottom:20,
							paddingLeft: 10, 
						}}
					>
							Code Editor
					</DialogTitle>
					<IconButton
						style={{
							marginLeft: isMobile ? "80%" : 350, 
							height: 50, 
							width: 50, 
						}}
						onClick={() => {
							
						}}
					>
						<Tooltip
							color="primary"
							title={"Test Liquid in the playground"}
							placement="top"
						>
							<a 
								href="https://pwwang.github.io/liquidpy/playground/"
								rel="norefferer"
                target="_blank"
							>
								<ExtensionIcon style={{color: "rgba(255,255,255,0.7)"}}/>
							</a>
						</Tooltip>
					</IconButton>
					<IconButton
						style={{
							height: 50, 
							width: 50, 
						}}
						onClick={() => {
							autoFormat(localcodedata) 
						}}
					>
						<Tooltip
							color="primary"
							title={"Auto format data"}
							placement="top"
						>
							<AutoFixHighIcon style={{color: "rgba(255,255,255,0.7)"}}/>
						</Tooltip>
					</IconButton>
				</div>
			</div>   }

		
			{ isFileEditor ? null :
			<div style={{display: "flex"}}>
				<Button
					id="basic-button"
					aria-haspopup="true"
					aria-controls={liquidOpen ? 'basic-menu' : undefined}
					aria-expanded={liquidOpen ? 'true' : undefined}
					variant="outlined"
					style={{
					  textTransform: "none",
						width: 100, 
					}}
					onClick={(event) => {
						setAnchorEl(event.currentTarget);
					}}
				>
					Filters 
				</Button>
				<Menu
					id="basic-menu"
					anchorEl={anchorEl}
					open={liquidOpen}
					onClose={() => {
						setAnchorEl(null);
					}}
					MenuListProps={{
						'aria-labelledby': 'basic-button',
					}}
				>
					{liquidFilters.map((item, index) => {
						return (
							<MenuItem key={index} onClick={() => {
								handleClick(item)
							}}>{item.name}</MenuItem>
						)
					})}
				</Menu>
				<Button
					id="basic-button"
					aria-haspopup="true"
					aria-controls={mathOpen ? 'basic-menu' : undefined}
					aria-expanded={mathOpen ? 'true' : undefined}
					variant="outlined"
					style={{
					  textTransform: "none",
						width: 100, 
					}}
					onClick={(event) => {
						setAnchorEl2(event.currentTarget);
					}}
				>
					Math 
				</Button>
				<Menu
					id="basic-menu"
					anchorEl={anchorEl2}
					open={mathOpen}
					onClose={() => {
						setAnchorEl2(null);
					}}
					MenuListProps={{
						'aria-labelledby': 'basic-button',
					}}
				>
					{mathFilters.map((item, index) => {
						return (
							<MenuItem key={index} onClick={() => {
								handleClick(item)
							}}>{item.name}</MenuItem>
						)
					})}
				</Menu>
				<Button
					id="basic-button"
					aria-haspopup="true"
					aria-controls={pythonOpen ? 'basic-menu' : undefined}
					aria-expanded={pythonOpen ? 'true' : undefined}
					variant="outlined"
					style={{
					  textTransform: "none",
						width: 100, 
					}}
					onClick={(event) => {
						setAnchorEl3(event.currentTarget);
					}}
				>
					Python	
				</Button>
				<Menu
					id="basic-menu"
					anchorEl={anchorEl3}
					open={pythonOpen}
					onClose={() => {
						setAnchorEl3(null);
					}}
					MenuListProps={{
						'aria-labelledby': 'basic-button',
					}}
				>
					{pythonFilters.map((item, index) => {
						return (
							<MenuItem key={index} onClick={() => {
								handleClick(item)
							}}>{item.name}</MenuItem>
						)
					})}
				</Menu> 
				<Button
					id="basic-button"
					aria-haspopup="true"
					aria-controls={!!menuPosition ? 'basic-menu' : undefined}
					aria-expanded={!!menuPosition ? 'true' : undefined}
					variant="outlined"
					style={{
					  textTransform: "none",
						width: 130, 
						marginLeft: 170, 
					}}
					onClick={(event) => {
						setMenuPosition({
							top: event.pageY,
							left: event.pageX,
						})
					}}
				>
					<AddIcon /> Autocomplete 
				</Button>
				<Menu
					anchorReference="anchorPosition"
					anchorPosition={menuPosition}
					onClose={() => {
						handleMenuClose();
					}}
					open={!!menuPosition}
					style={{
						color: "white",
						marginTop: 2,
						maxHeight: 650,
					}}
				>
					{actionlist.map((innerdata) => {
						const icon =
							innerdata.type === "action" ? (
								<AppsIcon style={{ marginRight: 10 }} />
							) : innerdata.type === "workflow_variable" ||
								innerdata.type === "execution_variable" ? (
								<FavoriteBorderIcon style={{ marginRight: 10 }} />
							) : (
								<ScheduleIcon style={{ marginRight: 10 }} />
							);

						const handleExecArgumentHover = (inside) => {
							var exec_text_field = document.getElementById(
								"execution_argument_input_field"
							);
							if (exec_text_field !== null) {
								if (inside) {
									exec_text_field.style.border = "2px solid #f85a3e";
								} else {
									exec_text_field.style.border = "";
								}
							}
						};

						const handleActionHover = (inside, actionId) => {
						};

						const handleMouseover = () => {
							if (innerdata.type === "Execution Argument") {
								handleExecArgumentHover(true);
							} else if (innerdata.type === "action") {
								handleActionHover(true, innerdata.id);
							}
						};

						const handleMouseOut = () => {
							if (innerdata.type === "Execution Argument") {
								handleExecArgumentHover(false);
							} else if (innerdata.type === "action") {
								handleActionHover(false, innerdata.id);
							}
						};

						var parsedPaths = [];
						if (typeof innerdata.example === "object") {
							parsedPaths = GetParsedPaths(innerdata.example, "");
						}

						const coverColor = "#82ccc3"
						//menuPosition.left -= 50
						//menuPosition.top -= 250 
						//console.log("POS: ", menuPosition1)
						var menuPosition1 = menuPosition
						if (menuPosition1 === null) {
							menuPosition1 = {
								"left": 0,
								"top": 0,
							}
						} else if (menuPosition1.top === null || menuPosition1.top === undefined) {
							menuPosition1.top = 0
						} else if (menuPosition1.left === null || menuPosition1.left === undefined) {
							menuPosition1.left = 0
						}

						//console.log("POS1: ", menuPosition1)

						return parsedPaths.length > 0 ? (
							<NestedMenuItem
								key={innerdata.name}
								label={
									<div style={{ display: "flex", marginLeft: 0, }}>
										{icon} {innerdata.name}
									</div>
								}
								parentMenuOpen={!!menuPosition}
								style={{
									color: "white",
									minWidth: 250,
									maxWidth: 250,
									maxHeight: 50,
									overflow: "hidden",
								}}
								onClick={() => {
									console.log("CLICKED: ", innerdata);
									console.log(innerdata.example)
									handleItemClick([innerdata]);
								}}
							>
								<Paper style={{minHeight: 500, maxHeight: 500, minWidth: 275, maxWidth: 275, position: "fixed", top: menuPosition1.top-200, left: menuPosition1.left-270, padding: "10px 0px 10px 10px", backgroundColor: theme.palette.inputColor, overflow: "hidden", overflowY: "auto", border: "1px solid rgba(255,255,255,0.3)",}}>
									<MenuItem
										key={innerdata.name}
										style={{
											backgroundColor: theme.palette.inputColor,
											marginLeft: 15,
											color: "white",
											minWidth: 250,
											maxWidth: 250,
											padding: 0, 
											position: "relative",
										}}
										value={innerdata}
										onMouseOver={() => {
											//console.log("HOVER: ", pathdata);
										}}
										onClick={() => {
											handleItemClick([innerdata]);
										}}
									>
										<Typography variant="h6" style={{paddingBottom: 5}}>
											{innerdata.name}
										</Typography>
									</MenuItem>
									{parsedPaths.map((pathdata, index) => {
										// FIXME: Should be recursive in here
										//<VpnKeyIcon style={iconStyle} />
										const icon =
											pathdata.type === "value" ? (
												<span style={{marginLeft: 9, }} />
											) : pathdata.type === "list" ? (
												<FormatListNumberedIcon style={{marginLeft: 9, marginRight: 10, }} />
											) : (
												<CircleIcon style={{marginLeft: 9, marginRight: 10, color: coverColor}}/>
											);
										//<ExpandMoreIcon style={iconStyle} />

										const indentation_count = (pathdata.name.match(/\./g) || []).length+1
										//const boxPadding = pathdata.type === "object" ? "10px 0px 0px 0px" : 0
										const boxPadding = 0 
										const namesplit = pathdata.name.split(".")
										const newname = namesplit[namesplit.length-1]
										return (
											<MenuItem
												key={pathdata.name}
												style={{
													backgroundColor: theme.palette.inputColor,
													color: "white",
													minWidth: 250,
													maxWidth: 250,
													padding: boxPadding, 
												}}
												value={pathdata}
												onMouseOver={() => {
													//console.log("HOVER: ", pathdata);
												}}
												onClick={() => {
													handleItemClick([innerdata, pathdata]);
												}}
											>
												<Tooltip
													color="primary"
													title={`Ex. value: ${pathdata.value}`}
													placement="left"
												>
													<div style={{ display: "flex", height: 30, }}>
														{Array(indentation_count).fill().map((subdata, subindex) => {
															return (
																<div key={subindex} style={{marginLeft: 20, height: 30, width: 1, backgroundColor: coverColor,}} />
															)
														})}
														{icon} {newname} 
														{pathdata.type === "list" ? <SquareFootIcon style={{marginleft: 10, }} onClick={(e) => {
															e.preventDefault()
															e.stopPropagation()

															console.log("INNER: ", innerdata, pathdata)
															
															// Removing .list from autocomplete
															var newname = pathdata.name
															if (newname.length > 5) {
																newname = newname.slice(0, newname.length-5)
															}

															//selectedActionParameters[count].value += `{{ $${innerdata.name}.${newname} | size }}`
															//selectedAction.parameters[count].value = selectedActionParameters[count].value;
															//setSelectedAction(selectedAction);
															//setShowDropdown(false);
															setMenuPosition(null);

															// innerdata.name
															// pathdata.name
															//handleItemClick([innerdata, newpathdata])
															//console.log("CLICK LENGTH!")
														}} /> : null}
													</div>
												</Tooltip>
											</MenuItem>
										);
									})}
								</Paper>
							</NestedMenuItem>
						) : (
							<MenuItem
								key={innerdata.name}
								style={{
									backgroundColor: theme.palette.inputColor,
									color: "white",
									minWidth: 250,
									maxWidth: 250,
									marginRight: 0,
								}}
								value={innerdata}
								onMouseOver={() => handleMouseover()}
								onMouseOut={() => {
									handleMouseOut();
								}}
								onClick={() => {
									handleItemClick([innerdata]);
								}}
							>
								<Tooltip
									color="primary"
									title={`Value: ${innerdata.value}`}
									placement="left"
								>
									<div style={{ display: "flex" }}>
										{icon} {innerdata.name}
									</div>
								</Tooltip>
							</MenuItem>
						);
					})}
				</Menu>

</div> }
			<span style={{
				border: `2px solid ${theme.palette.inputColor}`,
				borderRadius: theme.palette.borderRadius,
				position: "relative",
			}}>
				<CodeMirror
					value = {localcodedata}
					height=	{isFileEditor ? "450px" : "200px"}
					style={{
					}}
					onCursorActivity = {(value) => {
						// console.log(value.getCursor())
						setCurrentCharacter(value.getCursor().ch)
						setCurrentLine(value.getCursor().line)
						// console.log(value.getCursor().ch, value.getCursor().line)
						findIndex(value.getCursor().line, value.getCursor().ch)
						highlight_variables(value)
					}}
					onChange={(value) => {
						setlocalcodedata(value.getValue())
						expectedOutput(value.getValue())

						if(value.display.input.prevInput.startsWith('$') || value.display.input.prevInput.endsWith('$')){
							setEditorPopupOpen(true)
						}

						// console.log(findIndex(value.getValue()))
						// highlight_variables(value)
					}}
					options={{
						styleSelectedText: true,
						theme: codeTheme,
						keyMap: 'sublime',
						mode: 'python',
						lineWrapping: linewrap,
						// mode: {codelang},
					}}
				/>
			</span>
			{/*editorPopupOpen ?
				<Paper
					style={{
						margin: 10,
						padding: 10,
						width: isMobile ? "100%" : 250,
						height: 95,
						overflowY: 'auto',
						// textOverflow: 'ellipsis'
					}}
				>
					{mainVariables.map((data, index) => {
						// console.log(data)
						return (
							<div
								style={{
									// textOverflow: 'ellipsis'
								}}
							>
								<button
									onClick={() => {
										replaceVariables(data.substring(1,))
										// console.log(currentCharacter, currentLine)
									}}
									style={{
										backgroundColor: 'transparent',
										color: 'white',
										border: 'none',
										padding: 7.5,
										cursor: 'pointer',
										width: '100%',
										textAlign: 'left'
									}}
								>
									{data.substring(0, 25)}
								</button>
							</div>
						)
					})}
				</Paper>
			: null*/}

			<div
				style={{
				}}
			>
				{/*
				<Typography
					variant = 'body2'
					color = 'textSecondary'
					style={{
						color: "white",
						paddingLeft: 340,
						width: 50,
						display: 'inline',
					}}
				>
					Line Wrap
					<Checkbox
						onClick={() => {
							if (linewrap) {
								setlinewrap(false)
							}
							if (!linewrap){
								setlinewrap(true)
							}
						}}
						defaultChecked
						size="small"
						sx={{
							color: orange[600],
							'&.Mui-checked': {
							  color: orange[800],
							},
						}}
					/>
				</Typography>

				<Typography
					variant = 'body2'
					color = 'textSecondary'
					style={{
						color: "white",
						paddingLeft: 10,
						width: 100,
						display: 'inline',
					}}
				>
					Dark Theme
					<Checkbox
						onClick={() => {
							if (codeTheme === "gruvbox-dark") {
								setcodeTheme("duotone-light")
							}
							if (codeTheme === "duotone-light"){
								setcodeTheme("gruvbox-dark")
							}
						}}
						defaultChecked
						size="small"
						sx={{
							color: orange[600],
							'&.Mui-checked': {
							  color: orange[800],
							},
						}}
					/>
				</Typography>
				*/}

			</div>
				{isFileEditor ? null : (
					<div>
						{isMobile ? null : 
							<DialogTitle
								style={{
									marginTop: 20,
									paddingLeft: 10, 
								}}
							>
								<span
									style={{
										color: "white"
									}}
								>
									Expected Output
								</span>
								<IconButton disabled={executing} color="primary" style={{border: `1px solid ${theme.palette.primary.main}`, marginLeft: 300, padding: 8}} variant="contained" onClick={() => {
									executeSingleAction(expOutput)
								}}>
									<Tooltip title="Try it! This runs the Shuffle Tools 'repeat back to me' action with what you see in the expected output window." placement="top">
										{executing ? <CircularProgress style={{height: 18, width: 18, }} /> : <PlayArrowIcon style={{height: 18, width: 18, }} /> }
													 
									</Tooltip>
								</IconButton>
							</DialogTitle>
						}
						{isMobile ? null : 
							validation === true ? 
								<ReactJson
									src={expOutput}
									theme={theme.palette.jsonTheme}
									style={{
										borderRadius: 5,
										border: `2px solid ${theme.palette.inputColor}`,
										padding: 10, 
										maxHeight: 250, 
										minheight: 250, 
										overflow: "auto",
									}}
									collapsed={false}
									enableClipboard={(copy) => {
										//handleReactJsonClipboard(copy);
									}}
									displayDataTypes={false}
									onSelect={(select) => {
										//HandleJsonCopy(validate.result, select, "exec");
									}}
									name={"JSON autocompletion"}
								/>
							:
								<p
									id='expOutput'
									style={{
										whiteSpace: "pre-wrap",
										color: "#f85a3e",
										fontFamily: "monospace",
										backgroundColor: "#282828",
										padding: 20,
										marginTop: -2,
										border: `2px solid ${theme.palette.inputColor}`,
										borderRadius: theme.palette.borderRadius,
										maxHeight: 250,
										overflow: "auto", 
									}}
								>
									{expOutput}
								</p>
					}
						{executionResult.valid === true ? 
							<ReactJson
								src={executionResult.result}
								theme={theme.palette.jsonTheme}
								style={{
									borderRadius: 5,
									border: `2px solid ${theme.palette.inputColor}`,
									padding: 10, 
									maxHeight: 100, 
									minheight: 100, 
									overflow: "auto",
								}}
								collapsed={false}
								enableClipboard={(copy) => {
									//handleReactJsonClipboard(copy);
								}}
								displayDataTypes={false}
								onSelect={(select) => {
									//HandleJsonCopy(validate.result, select, "exec");
								}}
								name={"Test result"}
							/>
						:
						<span>
							{executionResult.result.length > 0 ? 
								<Typography variant="body2" style={{maxHeight: 100, overflow: "auto",}}>
									Test output: {executionResult.result}
								</Typography>
							: null}
						</span>
						}
					</div>
				)
				}
				<div style={{
						display: 'flex',
						paddingTop : 30, // maybe handle this as well?
					}}
				>
					<button
						style={{
							color: "white",
							background: "#383b49",
							border: "none",
							height: 35,
							flex: 1,
							marginLeft: 5,
							marginTop: 20,
							cursor: "pointer"
						}}
						onClick={() => {
							setExpansionModalOpen(false);
						}}
					>
						Cancel
					</button>
					<button
						style={{
							color: "white",
							background: "#f85a3e",
							border: "none",

							height: 35,
							flex: 1, 
							marginLeft: 10,
							marginTop: 20,
							cursor: "pointer"
						}}
						onClick={(event) => {
							// console.log(codedata)
							// console.log(fieldCount)
							if (isFileEditor === true){
								runUpdateText(localcodedata);
								setcodedata(localcodedata);
								setExpansionModalOpen(false)
							}
							else {
							changeActionParameterCodeMirror(event, fieldCount, localcodedata)
							setExpansionModalOpen(false)
							setcodedata(localcodedata)}
						}}
					>
						Done
					</button>
			</div>
		</Dialog>)
}

export default CodeEditor;
