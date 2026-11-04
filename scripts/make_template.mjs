import fs from 'fs';
import zlib from 'zlib';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PremiereData Version="3">
	<Project ObjectRef="1"/>
	<Project id="1" ClassID="9fd8536f-e3c3-4d76-8809-e855734e5a9c" Version="38">
		<Node Version="1">
			<Properties Version="1">
				<ProjectName>Clean Template</ProjectName>
				<ProjectID>00000000-0000-0000-0000-000000000001</ProjectID>
			</Properties>
		</Node>
		<RootProjectItem ObjectRef="2"/>
	</Project>
	<RootProjectGroup id="2" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>Root</Name>
			</Properties>
		</Node>
		<Items Version="1">
			<Item Index="0" ObjectRef="3"/>
			<Item Index="1" ObjectRef="4"/>
			<Item Index="2" ObjectRef="5"/>
			<Item Index="3" ObjectRef="6"/>
		</Items>
	</RootProjectGroup>
	<ProjectItem id="3" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>01 RAW FOOTAGE</Name>
			</Properties>
		</Node>
	</ProjectItem>
	<ProjectItem id="4" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>02 SEQUENCES</Name>
			</Properties>
		</Node>
	</ProjectItem>
	<ProjectItem id="5" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>03 AUDIO &amp; MUSIC</Name>
			</Properties>
		</Node>
	</ProjectItem>
	<ProjectItem id="6" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>04 GRAPHICS &amp; TITLES</Name>
			</Properties>
		</Node>
	</ProjectItem>
</PremiereData>`;

const gzipped = zlib.gzipSync(Buffer.from(xml, 'utf8'));
fs.writeFileSync('build/templates/premiere_clean_template.prproj', gzipped);
console.log('Saved build/templates/premiere_clean_template.prproj (' + gzipped.length + ' bytes)');
