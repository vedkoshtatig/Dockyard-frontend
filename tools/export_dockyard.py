import json
import struct
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.geometry import interpolate_bezier


PROJECT_ROOT = Path.cwd().resolve()
SOURCE_BLEND = Path(bpy.data.filepath).resolve()
SOURCE_ROOT = SOURCE_BLEND.parent
TEXTURE_ROOT = SOURCE_ROOT / "textures"
PUBLIC_MODELS = PROJECT_ROOT / "public" / "models"
WEB_TEXTURE_DIR = PUBLIC_MODELS / "dockyard" / "textures"
OPTIMIZED_BLEND = SOURCE_ROOT / f"{SOURCE_BLEND.stem}.optimized.blend"
GLB_PATH = PUBLIC_MODELS / "dockyard.glb"
MAX_TEXTURE_SIZE = 512
PATH_OBJECT_NAMES = {"roadn", "road"}
ANIMATED_HANGING_OBJECT_NAMES = {
    "hanging container",
    "hanging string 1",
    "hanging string 2",
}
STACK_TARGET_OBJECT_NAMES = {
    "base-container",
    "base container",
    "ship-base",
    "ship base",
}
SKYBOX_OBJECT_NAMES = {"skybox", "skybiox"}
FALLBACK_ROADN_POINTS = [
    (56.0222, -18.1790, 6.5779),
    (36.1934, -18.6626, 6.5779),
    (18.3518, -17.8991, 6.5779),
    (8.2639, -17.8163, 6.5779),
    (-2.1342, -18.0581, 6.5779),
    (-3.5850, -25.1916, 6.5779),
    (-3.4641, -44.5368, 6.5779),
    (-3.9478, -59.7711, 6.5779),
    (-1.8923, -67.5091, 6.5779),
    (18.1782, -67.3882, 6.5779),
    (18.2992, -64.7283, 6.5779),
    (18.5410, -42.2395, 6.5779),
    (18.4201, -29.7861, 6.5779),
    (18.1782, -21.5644, 6.5779),
    (18.2672, -18.1281, 6.5779),
    (18.1782, -21.5644, 6.5779),
    (18.4201, -29.7861, 6.5779),
    (18.5410, -42.2395, 6.5779),
    (18.2992, -64.7283, 6.5779),
    (18.1782, -67.3882, 6.5779),
    (36.4352, -66.3001, 6.5779),
    (36.4352, -65.4537, 6.5779),
    (36.0725, -56.0230, 6.5779),
    (36.3143, -44.7786, 6.5779),
    (36.6770, -33.4133, 6.5779),
    (36.3143, -22.4108, 6.5779),
    (36.3143, -19.0254, 6.5779),
    (36.3143, -22.4108, 6.5779),
    (36.6770, -33.4133, 6.5779),
    (36.3143, -44.7786, 6.5779),
    (36.0725, -56.0230, 6.5779),
    (36.4352, -65.4537, 6.5779),
    (36.4352, -66.3001, 6.5779),
    (51.3068, -67.6300, 6.5779),
    (56.7476, -64.4865, 6.5779),
    (57.5940, -57.7157, 6.5779),
    (57.5940, -48.0338, 6.5779),
    (57.5940, -38.3520, 6.5779),
    (57.5940, -28.6702, 6.5779),
    (57.5940, -18.9884, 6.5779),
]
VIEWER_TEXTURE_IMAGES = {
    "zone.jpg": "zone.jpg",
    "hangar_Base_Color.PNG": "hangar_Base_Color.jpg",
    "container_Base_Color.png": "container_Base_Color.jpg",
    "container2_Base_Color.png": "container2_Base_Color.jpg",
    "container3_Base_Color.png": "container3_Base_Color.jpg",
    "container4_Base_Color.png": "container4_Base_Color.jpg",
    "container5_Base_Color.png": "container5_Base_Color.jpg",
    "truck_Base_Color.png": "truck_Base_Color.jpg",
    "ship-room_Base_Color.png": "ship-room_Base_Color.jpg",
    "shipbody_Base_Color.png": "shipbody_Base_Color.jpg",
    "block_Base_Color.png": "block_Base_Color.jpg",
    "factory_Base_Color.png": "factory_Base_Color.jpg",
}
TRAILER_MAX_DISTANCE = 7.25


def purge_unused():
    for _ in range(3):
        bpy.ops.outliner.orphans_purge(
            do_local_ids=True,
            do_linked_ids=True,
            do_recursive=True,
        )


def deselect_all_objects():
    for obj in bpy.data.objects:
        obj.select_set(False)


def ensure_object_mode():
    active = bpy.context.view_layer.objects.active
    if active is None:
        active = next((obj for obj in bpy.context.scene.objects if obj.type == "MESH"), None)
        bpy.context.view_layer.objects.active = active

    if active and active.mode != "OBJECT" and bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="OBJECT")


def base_object_name(name):
    return name.rsplit(".", 1)[0].lower()


def is_path_object(obj):
    return base_object_name(obj.name) in PATH_OBJECT_NAMES


def is_animated_hanging_object(obj):
    return obj.name.lower() in ANIMATED_HANGING_OBJECT_NAMES


def is_stack_target_object(obj):
    return obj.name.lower() in STACK_TARGET_OBJECT_NAMES


def is_named_skybox_object(obj):
    return base_object_name(obj.name) in SKYBOX_OBJECT_NAMES


def material_uses_sky_texture(material):
    if material is None:
        return False

    if any(key in material.name.lower() for key in ("sky", "cloudy")):
        return True

    if not material.use_nodes:
        return False

    for node in material.node_tree.nodes:
        image = getattr(node, "image", None)
        if image is None:
            continue

        image_label = f"{image.name} {image.filepath}".lower()
        if "sky" in image_label or "cloudy" in image_label:
            return True

    return False


def is_sky_dome_object(obj):
    if obj.type != "MESH":
        return False

    if is_named_skybox_object(obj):
        return False

    name = base_object_name(obj.name)
    if any(key in name for key in ("sky", "cloudy")):
        return True

    return any(material_uses_sky_texture(slot.material) for slot in obj.material_slots)


def skybox_texture_names():
    texture_names = set()

    for obj in bpy.context.scene.objects:
        if not is_named_skybox_object(obj):
            continue

        for slot in obj.material_slots:
            material = slot.material
            if material is None or not material.use_nodes:
                continue

            for node in material.node_tree.nodes:
                image = getattr(node, "image", None)
                if image is not None:
                    texture_names.add(image.name)

    return texture_names


def material_uses_truck_texture(material):
    if material is None:
        return False

    if "truck" in material.name.lower():
        return True

    if not material.use_nodes:
        return False

    for node in material.node_tree.nodes:
        image = getattr(node, "image", None)
        if image and "truck" in image.name.lower():
            return True

    return False


def is_truck_object(obj):
    if obj.type != "MESH":
        return False

    name = base_object_name(obj.name)
    if name.startswith("truck") or name.startswith("vehicle"):
        return True

    return any(material_uses_truck_texture(slot.material) for slot in obj.material_slots)


def material_names(obj):
    return [
        slot.material.name
        for slot in getattr(obj, "material_slots", [])
        if slot.material is not None
    ]


def is_container_object(obj):
    if obj.type != "MESH":
        return False

    return any(name.lower().startswith("container") for name in material_names(obj))


def join_trailer_containers_to_trucks():
    ensure_object_mode()

    trucks = [obj for obj in bpy.context.scene.objects if is_truck_object(obj)]
    containers = [
        obj
        for obj in bpy.context.scene.objects
        if is_container_object(obj)
        and not is_animated_hanging_object(obj)
        and not is_stack_target_object(obj)
    ]
    if not trucks or not containers:
        return

    pairs = []
    for truck in trucks:
        truck_position = truck.matrix_world.translation
        for container in containers:
            if truck == container:
                continue

            distance = (truck_position - container.matrix_world.translation).length
            if distance <= TRAILER_MAX_DISTANCE:
                pairs.append((distance, truck.name, container.name))

    paired_trucks = set()
    paired_containers = set()
    for distance, truck_name, container_name in sorted(pairs, key=lambda item: item[0]):
        if truck_name in paired_trucks or container_name in paired_containers:
            continue

        truck = bpy.data.objects.get(truck_name)
        container = bpy.data.objects.get(container_name)
        if truck is None or container is None or truck == container:
            continue

        deselect_all_objects()
        truck.select_set(True)
        container.select_set(True)
        bpy.context.view_layer.objects.active = truck
        bpy.ops.object.join()

        paired_trucks.add(truck_name)
        paired_containers.add(container_name)
        print(f"Joined trailer {container_name} to {truck_name} ({distance:.2f} units)")


def spline_sample_count(curve):
    return max(8, curve.resolution_u * 4)


def sample_curve_points(obj):
    points = []

    for spline in obj.data.splines:
        if spline.type == "BEZIER":
            bezier_points = spline.bezier_points
            point_count = len(bezier_points)
            if point_count == 0:
                continue

            segment_count = point_count if spline.use_cyclic_u else point_count - 1
            for index in range(segment_count):
                current = bezier_points[index]
                following = bezier_points[(index + 1) % point_count]
                segment = interpolate_bezier(
                    current.co,
                    current.handle_right,
                    following.handle_left,
                    following.co,
                    spline_sample_count(obj.data),
                )

                for point in segment[:-1]:
                    points.append(obj.matrix_world @ point)

            last_index = 0 if spline.use_cyclic_u else point_count - 1
            points.append(obj.matrix_world @ bezier_points[last_index].co)
            continue

        spline_points = []
        for point in spline.points:
            coordinate = Vector((
                point.co.x / point.co.w,
                point.co.y / point.co.w,
                point.co.z / point.co.w,
            ))
            spline_points.append(obj.matrix_world @ coordinate)

        points.extend(spline_points)
        if spline.use_cyclic_u and len(spline_points) > 1:
            points.append(spline_points[0].copy())

    return points


def gltf_point(point):
    return [point.x, point.z, -point.y]


def create_path_mesh_object(name, points, collections=None):
    center_points = [Vector(point) for point in points]
    vertices = []
    faces = []

    for index, point in enumerate(center_points):
        previous_point = center_points[max(index - 1, 0)]
        next_point = center_points[min(index + 1, len(center_points) - 1)]
        tangent = next_point - previous_point

        if tangent.length == 0:
            tangent = Vector((1.0, 0.0, 0.0))

        side = Vector((-tangent.y, tangent.x, 0.0))
        if side.length == 0:
            side = Vector((1.0, 0.0, 0.0))

        side.normalize()
        side *= 0.08
        vertices.extend((tuple(point - side), tuple(point + side)))

    for index in range(len(center_points) - 1):
        left = index * 2
        faces.append((left, left + 1, left + 3, left + 2))

    mesh = bpy.data.meshes.new(f"{name}_path_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    path_object = bpy.data.objects.new(name, mesh)
    path_object["dockyard_motion_path"] = True
    path_object["dockyard_path_points"] = json.dumps([gltf_point(point) for point in center_points])

    target_collections = collections or [bpy.context.scene.collection]
    for collection in target_collections:
        collection.objects.link(path_object)

    return path_object


def convert_motion_paths_to_meshes():
    path_curves = [
        obj
        for obj in list(bpy.context.scene.objects)
        if obj.type == "CURVE" and is_path_object(obj)
    ]

    for curve in path_curves:
        points = sample_curve_points(curve)
        if len(points) < 2:
            print(f"Skipped path curve with too few points: {curve.name}")
            continue

        name = base_object_name(curve.name)
        create_path_mesh_object(name, points, list(curve.users_collection))
        bpy.data.objects.remove(curve, do_unlink=True)

    if any(is_path_object(obj) for obj in bpy.context.scene.objects):
        return

    create_path_mesh_object("roadn", [Vector(point) for point in FALLBACK_ROADN_POINTS])
    print("Created fallback roadn motion path")


def resolve_texture_paths():
    if TEXTURE_ROOT.exists():
        bpy.ops.file.find_missing_files(directory=str(TEXTURE_ROOT))

    for image in bpy.data.images:
        if image.packed_file or image.filepath:
            continue

        candidate = TEXTURE_ROOT / image.name
        if candidate.exists():
            image.filepath = bpy.path.relpath(str(candidate), start=str(SOURCE_ROOT))

    for image in list(bpy.data.images):
        width, height = image.size
        if image.packed_file or width > 0 or height > 0:
            continue

        for material in bpy.data.materials:
            if not material.use_nodes:
                continue

            nodes = material.node_tree.nodes
            for node in list(nodes):
                if node.bl_idname == "ShaderNodeTexImage" and node.image == image:
                    nodes.remove(node)

        print(f"Removed missing texture reference: {image.name}")
        bpy.data.images.remove(image)


def remove_hidden_and_non_mesh_objects():
    for obj in list(bpy.context.scene.objects):
        if obj.type == "CAMERA":
            continue

        if obj.hide_get() or obj.hide_viewport or obj.hide_render or is_sky_dome_object(obj):
            bpy.data.objects.remove(obj, do_unlink=True)
            continue

        if obj.type not in {"MESH", "EMPTY"}:
            bpy.data.objects.remove(obj, do_unlink=True)


def normalize_mesh_data():
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue

        if obj.data.users > 1:
            obj.data = obj.data.copy()

        mesh = obj.data
        mesh.name = f"{obj.name}_mesh"
        mesh.update()


def join_visible_meshes():
    ensure_object_mode()
    mesh_objects = [
        obj
        for obj in bpy.context.scene.objects
        if (
            obj.type == "MESH"
            and not is_truck_object(obj)
            and not is_path_object(obj)
            and not is_animated_hanging_object(obj)
            and not is_stack_target_object(obj)
            and not is_named_skybox_object(obj)
        )
    ]
    if len(mesh_objects) <= 1:
        return

    deselect_all_objects()
    for obj in mesh_objects:
        obj.select_set(True)

    bpy.context.view_layer.objects.active = mesh_objects[0]
    bpy.ops.object.join()

    joined = bpy.context.object
    joined.name = "dockyard_static_scene"
    joined.data.name = "dockyard_static_scene_mesh"
    joined.select_set(True)
    bpy.context.view_layer.objects.active = joined

    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    bpy.ops.object.shade_flat()


def name_motion_objects():
    trucks = [obj for obj in bpy.context.scene.objects if is_truck_object(obj)]
    trucks.sort(key=lambda obj: obj.name)

    for index, truck in enumerate(trucks, start=1):
        truck.name = f"truck_{index:03d}"
        truck.data.name = f"{truck.name}_mesh"


def clean_materials():
    for material in bpy.data.materials:
        material.name = material.name.replace(" ", "_")
        material.use_nodes = True


def simplify_material_nodes_for_viewer():
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue

        preserve_base_color_texture = material.name.lower().startswith("acmat_")
        principled = next(
            (node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"),
            None,
        )
        if principled is None:
            continue

        for input_socket in principled.inputs:
            if preserve_base_color_texture and input_socket.name == "Base Color":
                continue

            for link in list(input_socket.links):
                material.node_tree.links.remove(link)

        if "Metallic" in principled.inputs:
            principled.inputs["Metallic"].default_value = 0.0

        if "Roughness" in principled.inputs:
            principled.inputs["Roughness"].default_value = 0.82


def optimize_images_for_web():
    preserved_texture_names = skybox_texture_names()

    for image in bpy.data.images:
        width, height = image.size
        if width <= 0 or height <= 0:
            continue

        if image.name in preserved_texture_names:
            print(f"Kept skybox texture at original size: {image.name} {width}x{height}")
            continue

        longest_edge = max(width, height)
        if longest_edge <= MAX_TEXTURE_SIZE:
            continue

        scale = MAX_TEXTURE_SIZE / longest_edge
        new_width = max(1, round(width * scale))
        new_height = max(1, round(height * scale))
        image.scale(new_width, new_height)
        print(f"Scaled texture {image.name}: {width}x{height} -> {new_width}x{new_height}")


def export_viewer_textures():
    WEB_TEXTURE_DIR.mkdir(parents=True, exist_ok=True)

    for image_name, output_name in VIEWER_TEXTURE_IMAGES.items():
        image = bpy.data.images.get(image_name)
        if image is None or image.size[0] <= 0 or image.size[1] <= 0:
            print(f"Skipped viewer texture: {image_name}")
            continue

        image.file_format = "JPEG"
        image.save_render(str(WEB_TEXTURE_DIR / output_name))


def export_glb():
    PUBLIC_MODELS.mkdir(parents=True, exist_ok=True)

    export_kwargs = {
        "filepath": str(GLB_PATH),
        "export_format": "GLB",
        "use_selection": False,
        "export_apply": True,
        "export_yup": True,
        "export_cameras": False,
        "export_lights": False,
        "export_materials": "EXPORT",
        "export_image_format": "JPEG",
        "export_image_quality": 75,
        "export_texcoords": True,
        "export_normals": True,
        "export_tangents": False,
        "export_animations": False,
        "export_extras": True,
    }

    bpy.ops.export_scene.gltf(**export_kwargs)


def simplify_glb_json_for_viewer():
    data = bytearray(GLB_PATH.read_bytes())
    json_length = struct.unpack_from("<I", data, 12)[0]
    json_type = data[16:20].decode("utf-8")

    if json_type != "JSON":
        raise ValueError("Expected GLB JSON chunk first")

    json_start = 20
    json_end = json_start + json_length
    gltf = json.loads(bytes(data[json_start:json_end]).decode("utf-8"))

    for material in gltf.get("materials", []):
        material.pop("extensions", None)

    for mesh in gltf.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            primitive.get("attributes", {}).pop("COLOR_0", None)

    gltf.pop("extensionsUsed", None)
    gltf.pop("extensionsRequired", None)

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    if len(json_bytes) > json_length:
        raise ValueError("Simplified GLB JSON unexpectedly grew")

    data[json_start:json_start + len(json_bytes)] = json_bytes
    data[json_start + len(json_bytes):json_end] = b" " * (json_length - len(json_bytes))
    GLB_PATH.write_bytes(data)


def main():
    resolve_texture_paths()
    convert_motion_paths_to_meshes()
    remove_hidden_and_non_mesh_objects()
    purge_unused()
    clean_materials()
    simplify_material_nodes_for_viewer()
    optimize_images_for_web()
    export_viewer_textures()
    join_trailer_containers_to_trucks()
    normalize_mesh_data()
    name_motion_objects()
    join_visible_meshes()
    purge_unused()
    bpy.ops.wm.save_as_mainfile(filepath=str(OPTIMIZED_BLEND))
    export_glb()
    simplify_glb_json_for_viewer()

    mesh_count = len(bpy.data.meshes)
    object_count = len(bpy.data.objects)
    triangle_count = sum(len(poly.vertices) - 2 for mesh in bpy.data.meshes for poly in mesh.polygons)
    print(f"Optimized objects: {object_count}")
    print(f"Optimized meshes: {mesh_count}")
    print(f"Optimized triangles: {triangle_count}")
    print(f"Saved: {OPTIMIZED_BLEND}")
    print(f"Exported: {GLB_PATH}")


if __name__ == "__main__":
    main()
