import { BehaviorConfig, TerraDrawModeBehavior } from "./base.behavior";
import { TerraDrawMouseEvent } from "../common";
import { Feature, Position } from "geojson";
import { ClickBoundingBoxBehavior } from "./click-bounding-box.behavior";
import { BBoxPolygon, FeatureId } from "../store/store";
import { PixelDistanceBehavior } from "./pixel-distance.behavior";
import { nearestPointOnLine } from "../geometry/point-on-line";
import { webMercatorNearestPointOnLine } from "../geometry/web-mercator-point-on-line";

export class LineSnappingBehavior extends TerraDrawModeBehavior {
	constructor(
		readonly config: BehaviorConfig,
		private readonly pixelDistance: PixelDistanceBehavior,
		private readonly clickBoundingBox: ClickBoundingBoxBehavior,
	) {
		super(config);
	}

	/** Returns the nearest snappable coordinate - on first click there is no currentId so no need to provide */
	public getSnappableCoordinateFirstClick = (event: TerraDrawMouseEvent) => {
		return this.getSnappable(event, (feature) => {
			return Boolean(
				feature.properties && feature.properties.mode === this.mode,
			);
		});
	};

	public getSnappableCoordinate = (
		event: TerraDrawMouseEvent,
		currentFeatureId: FeatureId,
	) => {
		return this.getSnappable(event, (feature) => {
			return Boolean(
				feature.properties &&
					feature.properties.mode === this.mode &&
					feature.id !== currentFeatureId,
			);
		});
	};

	private getSnappable(
		event: TerraDrawMouseEvent,
		filter: (feature: Feature) => boolean,
	) {
		const boundingBox = this.clickBoundingBox.create(event) as BBoxPolygon;
		const features = this.store.search(boundingBox, filter);
		const closest: { coord: undefined | Position; minDistance: number } = {
			coord: undefined,
			minDistance: Infinity,
		};

		features.forEach((feature) => {
			let coordinates: Position[];
			if (feature.geometry.type === "Polygon") {
				coordinates = feature.geometry.coordinates[0];
			} else if (feature.geometry.type === "LineString") {
				coordinates = feature.geometry.coordinates;
			} else {
				return;
			}

			const lines: [Position, Position][] = [];

			for (let i = 0; i < coordinates.length - 1; i++) {
				lines.push([coordinates[i], coordinates[i + 1]]);
			}

			let nearest:
				| {
						coordinate: Position;
						distance: number;
				  }
				| undefined;

			const lngLat: Position = [event.lng, event.lat];

			if (this.config.projection === "web-mercator") {
				nearest = webMercatorNearestPointOnLine(lngLat, lines);
			} else if (this.config.projection === "globe") {
				nearest = nearestPointOnLine(lngLat, lines);
			}

			if (!nearest) {
				return;
			}

			const distance = this.pixelDistance.measure(event, nearest.coordinate);
			if (distance < closest.minDistance && distance < this.pointerDistance) {
				closest.coord = nearest.coordinate;
				closest.minDistance = distance;
			}
		});

		return closest.coord;
	}
}
